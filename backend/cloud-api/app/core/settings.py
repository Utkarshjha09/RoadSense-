from __future__ import annotations

import os


def get_database_url() -> str:
    value = os.getenv("DATABASE_URL", "").strip()
    if not value:
        raise RuntimeError(
            "DATABASE_URL is not set. Configure it before starting cloud-api."
        )
    return value


def get_db_pool_min_size() -> int:
    raw = os.getenv("DB_POOL_MIN_SIZE", "1").strip()
    try:
        value = int(raw)
    except ValueError:
        return 1
    return max(1, min(value, 20))


def get_db_pool_max_size() -> int:
    raw = os.getenv("DB_POOL_MAX_SIZE", "20").strip()
    try:
        value = int(raw)
    except ValueError:
        return 20
    return max(2, min(value, 100))


def get_db_pool_timeout_seconds() -> int:
    raw = os.getenv("DB_POOL_TIMEOUT_SECONDS", "10").strip()
    try:
        value = int(raw)
    except ValueError:
        return 10
    return max(3, min(value, 60))


def get_redis_url() -> str:
    value = os.getenv("REDIS_URL", "").strip()
    if not value:
        raise RuntimeError(
            "REDIS_URL is not set. Configure it before using the ingestion queue."
        )
    return value


def get_queue_name() -> str:
    return os.getenv("EVENT_QUEUE_NAME", "roadsense:events").strip() or "roadsense:events"


def get_queue_max_length() -> int:
    raw = os.getenv("QUEUE_MAX_LENGTH", "5000").strip()
    try:
        value = int(raw)
    except ValueError:
        return 5000
    return max(100, min(value, 200000))


def get_worker_batch_size() -> int:
    raw = os.getenv("WORKER_BATCH_SIZE", "50").strip()
    try:
        value = int(raw)
    except ValueError:
        return 50
    return max(1, min(value, 500))


def get_model_h5_url() -> str:
    return os.getenv("MODEL_H5_URL", "").strip()


def get_model_tflite_url() -> str:
    # Backward compatible with previous single model naming.
    return (os.getenv("MODEL_TFLITE_URL", "").strip() or os.getenv("MODEL_URL", "").strip())


def get_model_h5_local_path() -> str:
    return os.getenv("MODEL_H5_LOCAL_PATH", "/tmp/road_sense_model.h5").strip() or "/tmp/road_sense_model.h5"


def get_model_tflite_local_path() -> str:
    return (
        os.getenv("MODEL_TFLITE_LOCAL_PATH", "").strip()
        or os.getenv("MODEL_LOCAL_PATH", "").strip()
        or "/tmp/road_sense_model.tflite"
    )


def get_model_ensemble_weights() -> tuple[float, float]:
    h5_weight = os.getenv("MODEL_WEIGHT_H5", "0.55").strip()
    tflite_weight = os.getenv("MODEL_WEIGHT_TFLITE", "0.45").strip()
    try:
        h5_value = max(0.0, float(h5_weight))
        tflite_value = max(0.0, float(tflite_weight))
    except ValueError:
        return (0.55, 0.45)
    total = h5_value + tflite_value
    if total <= 0:
        return (0.55, 0.45)
    return (h5_value / total, tflite_value / total)


def get_model_version() -> str:
    return os.getenv("MODEL_VERSION", "ensemble-v1").strip() or "ensemble-v1"
