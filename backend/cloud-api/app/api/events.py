import os

from fastapi import APIRouter, Header, HTTPException, Query

from app.models.events import FeedbackLabelRequest, LiveUploadRequest, SyncUploadRequest
from app.services.event_ingest import persist_event_batch
from app.services.inference import classify_event
from app.services.prediction_store import fetch_latest_predictions, update_training_label
from app.services.prediction_store import upsert_prediction
from app.services.queue_publish import enqueue_for_inference
from app.services.test_data import delete_placeholder_test_data, truncate_all_event_data

router = APIRouter(prefix="/v1", tags=["events"])


def _run_inline_inference(events):
    # Fallback path when Redis queue/worker is unavailable.
    # We infer only the freshest event to keep API latency stable.
    if not events:
        return 0

    event = events[-1]
    prediction = classify_event(event)
    upsert_prediction(
        event_id=event.event_id,
        predicted_type=prediction.predicted_type,
        confidence=prediction.confidence,
        model_version=prediction.model_version,
    )
    return 1


def _dev_endpoints_enabled() -> bool:
    if os.getenv("ALLOW_DEV_ENDPOINTS", "").strip() in {"1", "true", "TRUE", "yes", "YES"}:
        return True
    return os.getenv("ENVIRONMENT", "").strip().lower() in {"dev", "development", "local"}


def _require_api_secret(x_api_secret: str | None) -> None:
    expected = os.getenv("API_SECRET", "").strip()
    if not expected:
        return
    incoming = (x_api_secret or "").strip()
    if incoming != expected:
        raise HTTPException(status_code=401, detail="Invalid API secret")


@router.post("/events/batch")
def ingest_live_events(payload: LiveUploadRequest, x_api_secret: str | None = Header(default=None)) -> dict[str, object]:
    _require_api_secret(x_api_secret)
    result = persist_event_batch(payload.events, ingest_mode="live")
    inserted_id_set = set(result.inserted_event_ids)
    new_events = [event for event in payload.events if event.event_id in inserted_id_set]
    queue_error = None
    inline_predicted = 0
    try:
        enqueued = enqueue_for_inference(new_events) if new_events else 0
    except Exception as exc:
        enqueued = 0
        queue_error = str(exc)
        try:
            inline_predicted = _run_inline_inference(new_events)
        except Exception as inline_exc:
            raise HTTPException(
                status_code=500,
                detail=f"Queue unavailable and inline inference failed: {inline_exc}",
            ) from inline_exc
    return {
        "ok": True,
        "mode": "live",
        "received": result.received,
        "inserted": result.inserted,
        "duplicates": result.duplicates,
        "enqueued": enqueued,
        "inline_predicted": inline_predicted,
        "queue_error": queue_error,
    }


@router.post("/sync/batch")
def ingest_sync_events(payload: SyncUploadRequest, x_api_secret: str | None = Header(default=None)) -> dict[str, object]:
    _require_api_secret(x_api_secret)
    result = persist_event_batch(payload.events, ingest_mode="sync")
    inserted_id_set = set(result.inserted_event_ids)
    new_events = [event for event in payload.events if event.event_id in inserted_id_set]
    queue_error = None
    inline_predicted = 0
    try:
        enqueued = enqueue_for_inference(new_events) if new_events else 0
    except Exception as exc:
        enqueued = 0
        queue_error = str(exc)
        try:
            inline_predicted = _run_inline_inference(new_events)
        except Exception as inline_exc:
            raise HTTPException(
                status_code=500,
                detail=f"Queue unavailable and inline inference failed: {inline_exc}",
            ) from inline_exc
    return {
        "ok": True,
        "mode": "sync",
        "received": result.received,
        "inserted": result.inserted,
        "duplicates": result.duplicates,
        "enqueued": enqueued,
        "inline_predicted": inline_predicted,
        "queue_error": queue_error,
    }


@router.get("/predictions/latest")
def get_latest_predictions(
    limit: int = Query(default=20, ge=1, le=200),
    predicted_type: str | None = Query(default=None),
    device_id: str | None = Query(default=None),
    source: str | None = Query(default=None),
    x_api_secret: str | None = Header(default=None),
) -> dict[str, object]:
    _require_api_secret(x_api_secret)
    normalized_type = predicted_type.strip().upper() if predicted_type else None
    normalized_device_id = device_id.strip() if device_id else None
    normalized_source = source.strip().lower() if source else None
    if normalized_type is not None and normalized_type not in {"SMOOTH", "POTHOLE", "SPEED_BUMP"}:
        return {
            "ok": False,
            "error": "predicted_type must be one of: SMOOTH, POTHOLE, SPEED_BUMP",
        }
    if normalized_source is not None and normalized_source not in {"phone", "esp32"}:
        return {
            "ok": False,
            "error": "source must be one of: phone, esp32",
        }

    items = fetch_latest_predictions(
        limit=limit,
        predicted_type=normalized_type,
        device_id=normalized_device_id,
        source=normalized_source,
    )
    return {
        "ok": True,
        "count": len(items),
        "items": items,
    }


@router.post("/feedback/label")
def submit_feedback_label(payload: FeedbackLabelRequest, x_api_secret: str | None = Header(default=None)) -> dict[str, object]:
    _require_api_secret(x_api_secret)
    updated = update_training_label(
        event_id=payload.event_id,
        true_label=payload.true_label,
        label_source=payload.label_source.strip() or "app_feedback",
    )
    if not updated:
        return {
            "ok": False,
            "error": "event_id not found in training_samples",
        }
    return {
        "ok": True,
        "event_id": payload.event_id,
        "true_label": payload.true_label,
        "label_source": payload.label_source,
    }


@router.delete("/test-data")
def clear_test_data(clear_all: bool = Query(default=False), x_api_secret: str | None = Header(default=None)) -> dict[str, object]:
    _require_api_secret(x_api_secret)
    if not _dev_endpoints_enabled():
        raise HTTPException(status_code=403, detail="Dev-only endpoint is disabled")

    if clear_all:
        truncate_all_event_data()
        return {"ok": True, "mode": "all", "deleted": "all"}

    deleted = delete_placeholder_test_data()
    return {"ok": True, "mode": "placeholder", "deleted": deleted}
