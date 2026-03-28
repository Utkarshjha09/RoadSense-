from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


WINDOW_SIZE = 100


class SensorSample(BaseModel):
    timestamp: int | float
    ax: float
    ay: float
    az: float
    gx: float
    gy: float
    gz: float
    latitude: float
    longitude: float
    speed_kmh: float | None = None


class PredictWindowRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: Literal["phone", "esp32"]
    user_id: str | None = None
    device_id: str | None = None
    samples: list[SensorSample] = Field(min_length=WINDOW_SIZE, max_length=WINDOW_SIZE)

    @field_validator("samples")
    @classmethod
    def validate_window_size(cls, samples: list[SensorSample]) -> list[SensorSample]:
        if len(samples) != WINDOW_SIZE:
            raise ValueError(f"Exactly {WINDOW_SIZE} samples are required for inference")
        return samples


class LocationPayload(BaseModel):
    latitude: float
    longitude: float


class PredictWindowResponse(BaseModel):
    class_id: int
    class_name: Literal["Smooth", "Pothole", "SpeedBump"]
    confidence: float
    window_size: int
    source: Literal["phone", "esp32"]
    representative_location: LocationPayload
    stored_anomaly_id: str | None = None
    stored: bool = False
    sensor_event_id: str | None = None
    cluster_id: str | None = None
    cluster_state: Literal["SMOOTH", "POTHOLE", "SPEED_BUMP"] | None = None
    cluster_confidence: float | None = None
    cluster_active: bool | None = None
    window_log_id: str | None = None


class HealthResponse(BaseModel):
    status: Literal["ok"]
    model_ready: bool
    model_path: str
    supabase_configured: bool
    store_smooth_windows: bool
    cluster_radius_meters: float
