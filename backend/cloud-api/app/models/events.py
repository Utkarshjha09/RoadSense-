from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class SensorSource(str, Enum):
    phone = "phone"
    esp32 = "esp32"


class EventRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_id: Annotated[str, Field(min_length=1, max_length=128)]
    device_id: Annotated[str, Field(min_length=1, max_length=128)]
    source: SensorSource
    timestamp: datetime
    lat: Annotated[float, Field(ge=-90, le=90)]
    lng: Annotated[float, Field(ge=-180, le=180)]
    ax: float
    ay: float
    az: float
    gx: float
    gy: float
    gz: float
    speed: Annotated[float | None, Field(default=None, ge=0)] = None

    @field_validator("timestamp", mode="before")
    @classmethod
    def parse_timestamp(cls, value: object) -> datetime:
        # Accept ISO timestamp strings as well as unix seconds/milliseconds.
        if isinstance(value, (int, float)):
            seconds = float(value)
            if seconds > 1_000_000_000_000:
                seconds = seconds / 1000.0
            return datetime.fromtimestamp(seconds, tz=timezone.utc)
        return value  # Let Pydantic handle ISO strings/datetime objects.

    @field_validator("event_id", "device_id")
    @classmethod
    def reject_placeholder_ids(cls, value: str) -> str:
        if value.strip().lower() in {"string", "test", "example"}:
            raise ValueError("placeholder id values are not allowed")
        return value

    @model_validator(mode="after")
    def reject_placeholder_coordinates(self) -> "EventRecord":
        # Swagger placeholder payload often uses these extreme coordinates.
        if self.lat == -90 and self.lng == -180:
            raise ValueError("placeholder coordinates (-90, -180) are not allowed")
        return self


class EventBatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    events: Annotated[list[EventRecord], Field(min_length=1, max_length=2000)]


# Step 2 requirement: both live upload and offline sync use the same schema.
class LiveUploadRequest(EventBatch):
    pass


class SyncUploadRequest(EventBatch):
    pass


class FeedbackLabelRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_id: Annotated[str, Field(min_length=1, max_length=128)]
    true_label: Annotated[str, Field(min_length=3, max_length=16)]
    label_source: Annotated[str, Field(min_length=2, max_length=64)] = "app_feedback"

    @field_validator("true_label")
    @classmethod
    def normalize_label(cls, value: str) -> str:
        normalized = value.strip().upper()
        if normalized not in {"SMOOTH", "POTHOLE", "SPEED_BUMP"}:
            raise ValueError("true_label must be one of: SMOOTH, POTHOLE, SPEED_BUMP")
        return normalized
