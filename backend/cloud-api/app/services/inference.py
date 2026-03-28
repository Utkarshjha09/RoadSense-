from __future__ import annotations

from dataclasses import dataclass

from app.models.events import EventRecord


PredictionType = str


@dataclass(frozen=True)
class InferenceResult:
    predicted_type: PredictionType
    confidence: float
    model_version: str = "placeholder-v1"


def classify_event(event: EventRecord) -> InferenceResult:
    # Placeholder cloud classifier until real ML model is integrated.
    shock = abs(event.az - 9.81) + (abs(event.ax) + abs(event.ay)) * 0.35
    angular = abs(event.gx) + abs(event.gy) + abs(event.gz)
    score = shock + angular * 0.15

    if score >= 4.0:
        return InferenceResult(predicted_type="POTHOLE", confidence=0.82)
    if score >= 2.2:
        return InferenceResult(predicted_type="SPEED_BUMP", confidence=0.72)
    return InferenceResult(predicted_type="SMOOTH", confidence=0.90)

