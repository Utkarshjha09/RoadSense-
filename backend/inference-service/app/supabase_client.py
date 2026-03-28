from __future__ import annotations

from typing import Any

from supabase import Client, create_client

from .config import Settings


def build_client(settings: Settings) -> Client | None:
    if not settings.supabase_configured:
        return None
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def maybe_store_anomaly(
    client: Client | None,
    *,
    user_id: str | None,
    class_name: str,
    confidence: float,
    latitude: float,
    longitude: float,
) -> dict[str, Any]:
    if client is None or class_name == "Smooth":
        return {"stored": False, "stored_anomaly_id": None}

    anomaly_type = "POTHOLE" if class_name == "Pothole" else "SPEED_BUMP"
    rpc = client.rpc(
        "insert_anomaly",
        {
            "p_user_id": user_id,
            "p_type": anomaly_type,
            "p_severity": confidence,
            "p_confidence": confidence,
            "p_latitude": latitude,
            "p_longitude": longitude,
            "p_speed": None,
            "p_image_url": None,
        },
    ).execute()

    return {
        "stored": bool(rpc.data),
        "stored_anomaly_id": rpc.data,
    }


def record_prediction_event(
    client: Client | None,
    *,
    user_id: str | None,
    source: str,
    device_id: str | None,
    class_name: str,
    confidence: float,
    sample_count: int,
    latitude: float,
    longitude: float,
    cluster_radius_meters: float,
) -> dict[str, Any]:
    if client is None:
        return {
            "sensor_event_id": None,
            "cluster_id": None,
            "cluster_state": None,
            "cluster_confidence": None,
            "cluster_active": None,
        }

    predicted_type = {
        "Smooth": "SMOOTH",
        "Pothole": "POTHOLE",
        "SpeedBump": "SPEED_BUMP",
    }[class_name]

    rpc = client.rpc(
        "record_sensor_event",
        {
            "p_user_id": user_id,
            "p_source": source,
            "p_device_id": device_id,
            "p_predicted_type": predicted_type,
            "p_confidence": confidence,
            "p_sample_count": sample_count,
            "p_latitude": latitude,
            "p_longitude": longitude,
            "p_cluster_radius_meters": cluster_radius_meters,
        },
    ).execute()

    row = rpc.data[0] if rpc.data else {}
    return {
        "sensor_event_id": row.get("event_id"),
        "cluster_id": row.get("cluster_id"),
        "cluster_state": row.get("current_state"),
        "cluster_confidence": row.get("confidence_score"),
        "cluster_active": row.get("active"),
    }


def store_sensor_window_log(
    client: Client | None,
    *,
    user_id: str | None,
    source: str,
    device_id: str | None,
    predicted_type: str,
    confidence: float,
    sample_count: int,
    latitude: float,
    longitude: float,
    features_summary: dict[str, Any],
    window_started_at: str | None,
    window_ended_at: str | None,
) -> dict[str, Any]:
    if client is None:
        return {"window_log_id": None}

    rpc = client.rpc(
        "insert_sensor_window_log",
        {
            "p_user_id": user_id,
            "p_source": source,
            "p_device_id": device_id,
            "p_latitude": latitude,
            "p_longitude": longitude,
            "p_sample_count": sample_count,
            "p_predicted_type": predicted_type,
            "p_confidence": confidence,
            "p_features_summary": features_summary,
            "p_window_started_at": window_started_at,
            "p_window_ended_at": window_ended_at,
        },
    ).execute()

    return {"window_log_id": rpc.data}
