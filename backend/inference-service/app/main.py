from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException

from .config import get_settings
from .model_loader import ModelRegistry
from .preprocess import preprocess_window, representative_location
from .schemas import HealthResponse, PredictWindowRequest, PredictWindowResponse
from .supabase_client import (
    build_client,
    maybe_store_anomaly,
    record_prediction_event,
    store_sensor_window_log,
)


settings = get_settings()
model_registry = ModelRegistry(settings.resolved_model_path)
supabase_client = build_client(settings)


def _to_iso_utc(ts: int | float) -> str:
    value = float(ts)
    if value > 10_000_000_000:
        value = value / 1000.0
    return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        model_registry.load()
    except Exception as exc:  # noqa: BLE001
        print(f"[inference-service] model warmup failed: {exc}")
    yield


app = FastAPI(
    title="RoadSense Cloud Inference Service",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        model_ready=model_registry.ready,
        model_path=str(settings.resolved_model_path),
        supabase_configured=settings.supabase_configured,
        store_smooth_windows=settings.store_smooth_windows,
        cluster_radius_meters=settings.cluster_radius_meters,
    )


@app.post("/predict-window", response_model=PredictWindowResponse)
async def predict_window(payload: PredictWindowRequest) -> PredictWindowResponse:
    try:
        model_input = preprocess_window(payload)
        class_id, confidence, class_name = model_registry.predict(model_input)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Inference failed: {exc}") from exc

    latitude, longitude = representative_location(payload)
    should_store = class_name != "Smooth" or settings.store_smooth_windows
    predicted_type = {
        "Smooth": "SMOOTH",
        "Pothole": "POTHOLE",
        "SpeedBump": "SPEED_BUMP",
    }[class_name]

    ax_values = [sample.ax for sample in payload.samples]
    ay_values = [sample.ay for sample in payload.samples]
    az_values = [sample.az for sample in payload.samples]
    gx_values = [sample.gx for sample in payload.samples]
    gy_values = [sample.gy for sample in payload.samples]
    gz_values = [sample.gz for sample in payload.samples]
    speeds = [sample.speed_kmh for sample in payload.samples if sample.speed_kmh is not None]

    features_summary = {
        "ax_mean": sum(ax_values) / len(ax_values),
        "ay_mean": sum(ay_values) / len(ay_values),
        "az_mean": sum(az_values) / len(az_values),
        "gx_mean": sum(gx_values) / len(gx_values),
        "gy_mean": sum(gy_values) / len(gy_values),
        "gz_mean": sum(gz_values) / len(gz_values),
        "ax_peak_abs": max(abs(v) for v in ax_values),
        "ay_peak_abs": max(abs(v) for v in ay_values),
        "az_peak_abs": max(abs(v) for v in az_values),
        "gyro_peak_abs": max(max(abs(v) for v in gx_values), max(abs(v) for v in gy_values), max(abs(v) for v in gz_values)),
        "speed_kmh_mean": (sum(speeds) / len(speeds)) if speeds else None,
    }

    event_result = {
        "sensor_event_id": None,
        "cluster_id": None,
        "cluster_state": None,
        "cluster_confidence": None,
        "cluster_active": None,
    }
    if should_store:
        try:
            event_result = record_prediction_event(
                supabase_client,
                user_id=payload.user_id,
                source=payload.source,
                device_id=payload.device_id,
                class_name=class_name,
                confidence=confidence,
                sample_count=len(payload.samples),
                latitude=latitude,
                longitude=longitude,
                cluster_radius_meters=settings.cluster_radius_meters,
            )
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=500,
                detail=f"Prediction succeeded, but sensor-event aggregation failed: {exc}",
            ) from exc

    window_log_result = {"window_log_id": None}
    try:
        window_log_result = store_sensor_window_log(
            supabase_client,
            user_id=payload.user_id,
            source=payload.source,
            device_id=payload.device_id,
            predicted_type=predicted_type,
            confidence=confidence,
            sample_count=len(payload.samples),
            latitude=latitude,
            longitude=longitude,
            features_summary=features_summary,
            window_started_at=_to_iso_utc(payload.samples[0].timestamp),
            window_ended_at=_to_iso_utc(payload.samples[-1].timestamp),
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500,
            detail=f"Prediction succeeded, but sensor window log storage failed: {exc}",
        ) from exc

    storage_result = {"stored": False, "stored_anomaly_id": None}
    if class_name != "Smooth":
        try:
            storage_result = maybe_store_anomaly(
                supabase_client,
                user_id=payload.user_id,
                class_name=class_name,
                confidence=confidence,
                latitude=latitude,
                longitude=longitude,
            )
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=500, detail=f"Prediction succeeded, but Supabase insert failed: {exc}") from exc

    return PredictWindowResponse(
        class_id=class_id,
        class_name=class_name,
        confidence=confidence,
        window_size=len(payload.samples),
        source=payload.source,
        representative_location={
            "latitude": latitude,
            "longitude": longitude,
        },
        stored=storage_result["stored"],
        stored_anomaly_id=storage_result["stored_anomaly_id"],
        sensor_event_id=event_result["sensor_event_id"],
        cluster_id=event_result["cluster_id"],
        cluster_state=event_result["cluster_state"],
        cluster_confidence=event_result["cluster_confidence"],
        cluster_active=event_result["cluster_active"],
        window_log_id=window_log_result["window_log_id"],
    )
