import os

from fastapi import APIRouter, HTTPException, Query

from app.models.events import FeedbackLabelRequest, LiveUploadRequest, SyncUploadRequest
from app.services.event_ingest import persist_event_batch
from app.services.prediction_store import fetch_latest_predictions, update_training_label
from app.services.queue_publish import enqueue_for_inference
from app.services.test_data import delete_placeholder_test_data, truncate_all_event_data

router = APIRouter(prefix="/v1", tags=["events"])


def _dev_endpoints_enabled() -> bool:
    if os.getenv("ALLOW_DEV_ENDPOINTS", "").strip() in {"1", "true", "TRUE", "yes", "YES"}:
        return True
    return os.getenv("ENVIRONMENT", "").strip().lower() in {"dev", "development", "local"}


@router.post("/events/batch")
def ingest_live_events(payload: LiveUploadRequest) -> dict[str, object]:
    result = persist_event_batch(payload.events, ingest_mode="live")
    inserted_id_set = set(result.inserted_event_ids)
    new_events = [event for event in payload.events if event.event_id in inserted_id_set]
    queue_error = None
    try:
        enqueued = enqueue_for_inference(new_events) if new_events else 0
    except Exception as exc:
        enqueued = 0
        queue_error = str(exc)
    return {
        "ok": True,
        "mode": "live",
        "received": result.received,
        "inserted": result.inserted,
        "duplicates": result.duplicates,
        "enqueued": enqueued,
        "queue_error": queue_error,
    }


@router.post("/sync/batch")
def ingest_sync_events(payload: SyncUploadRequest) -> dict[str, object]:
    result = persist_event_batch(payload.events, ingest_mode="sync")
    inserted_id_set = set(result.inserted_event_ids)
    new_events = [event for event in payload.events if event.event_id in inserted_id_set]
    queue_error = None
    try:
        enqueued = enqueue_for_inference(new_events) if new_events else 0
    except Exception as exc:
        enqueued = 0
        queue_error = str(exc)
    return {
        "ok": True,
        "mode": "sync",
        "received": result.received,
        "inserted": result.inserted,
        "duplicates": result.duplicates,
        "enqueued": enqueued,
        "queue_error": queue_error,
    }


@router.get("/predictions/latest")
def get_latest_predictions(
    limit: int = Query(default=20, ge=1, le=200),
    predicted_type: str | None = Query(default=None),
) -> dict[str, object]:
    normalized_type = predicted_type.strip().upper() if predicted_type else None
    if normalized_type is not None and normalized_type not in {"SMOOTH", "POTHOLE", "SPEED_BUMP"}:
        return {
            "ok": False,
            "error": "predicted_type must be one of: SMOOTH, POTHOLE, SPEED_BUMP",
        }

    items = fetch_latest_predictions(limit=limit, predicted_type=normalized_type)
    return {
        "ok": True,
        "count": len(items),
        "items": items,
    }


@router.post("/feedback/label")
def submit_feedback_label(payload: FeedbackLabelRequest) -> dict[str, object]:
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
def clear_test_data(clear_all: bool = Query(default=False)) -> dict[str, object]:
    if not _dev_endpoints_enabled():
        raise HTTPException(status_code=403, detail="Dev-only endpoint is disabled")

    if clear_all:
        truncate_all_event_data()
        return {"ok": True, "mode": "all", "deleted": "all"}

    deleted = delete_placeholder_test_data()
    return {"ok": True, "mode": "placeholder", "deleted": deleted}
