from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from urllib.request import urlretrieve

import numpy as np

from app.core.settings import (
    get_model_ensemble_weights,
    get_model_h5_local_path,
    get_model_h5_url,
    get_model_tflite_local_path,
    get_model_tflite_url,
    get_model_version,
)
from app.models.events import EventRecord


PredictionType = str


@dataclass(frozen=True)
class InferenceResult:
    predicted_type: PredictionType
    confidence: float
    model_version: str = "placeholder-v1"


CLASS_NAMES = {
    0: "SMOOTH",
    1: "POTHOLE",
    2: "SPEED_BUMP",
}


class EnsembleInferenceEngine:
    def __init__(self) -> None:
        self._lock = Lock()
        self._ready = False
        self._h5_model = None
        self._tflite_interpreter = None
        self._tflite_input_index: int | None = None
        self._tflite_output_index: int | None = None
        self._enabled_models: list[str] = []
        self._weights = get_model_ensemble_weights()
        self._version = get_model_version()

    def _download_if_needed(self, url: str, target_path: Path) -> None:
        if not url:
            return
        if target_path.exists():
            return
        target_path.parent.mkdir(parents=True, exist_ok=True)
        urlretrieve(url, target_path)

    def _load_models(self) -> None:
        if self._ready:
            return
        with self._lock:
            if self._ready:
                return

            # Load H5 model if available.
            h5_url = get_model_h5_url()
            h5_path = Path(get_model_h5_local_path())
            if h5_url:
                try:
                    self._download_if_needed(h5_url, h5_path)
                except Exception as exc:  # noqa: BLE001
                    print(f"[inference] H5 download failed: {exc}")
            if h5_path.exists():
                try:
                    import tensorflow as tf

                    self._h5_model = tf.keras.models.load_model(str(h5_path))
                    self._enabled_models.append("h5")
                    print(f"[inference] H5 model loaded from {h5_path}")
                except Exception as exc:  # noqa: BLE001
                    print(f"[inference] H5 model load failed: {exc}")

            # Load TFLite model if available.
            tflite_url = get_model_tflite_url()
            tflite_path = Path(get_model_tflite_local_path())
            if tflite_url:
                try:
                    self._download_if_needed(tflite_url, tflite_path)
                except Exception as exc:  # noqa: BLE001
                    print(f"[inference] TFLite download failed: {exc}")
            if tflite_path.exists():
                try:
                    import tensorflow as tf

                    interpreter = tf.lite.Interpreter(model_path=str(tflite_path))
                    interpreter.allocate_tensors()
                    input_details = interpreter.get_input_details()
                    output_details = interpreter.get_output_details()
                    self._tflite_interpreter = interpreter
                    self._tflite_input_index = int(input_details[0]["index"])
                    self._tflite_output_index = int(output_details[0]["index"])
                    self._enabled_models.append("tflite")
                    print(f"[inference] TFLite model loaded from {tflite_path}")
                except Exception as exc:  # noqa: BLE001
                    print(f"[inference] TFLite model load failed: {exc}")

            self._ready = True

    def status(self) -> dict[str, object]:
        self._load_models()
        return {
            "ready": len(self._enabled_models) > 0,
            "enabled_models": self._enabled_models[:],
            "weights": {"h5": self._weights[0], "tflite": self._weights[1]},
            "version": self._version,
        }

    def _event_to_window(self, event: EventRecord) -> np.ndarray:
        # Model expects [1, 100, 8] (imu + gps). For streaming single-event inference,
        # replicate current reading across the window.
        feature = np.array(
            [
                event.ax,
                event.ay,
                event.az,
                event.gx,
                event.gy,
                event.gz,
                event.lat,
                event.lng,
            ],
            dtype=np.float32,
        )
        window = np.tile(feature, (100, 1))
        return window.reshape(1, 100, 8)

    def _predict_h5(self, model_input: np.ndarray) -> np.ndarray | None:
        if self._h5_model is None:
            return None
        try:
            probs = self._h5_model.predict(model_input, verbose=0)[0]
            return np.asarray(probs, dtype=np.float32)
        except Exception as exc:  # noqa: BLE001
            print(f"[inference] H5 predict failed: {exc}")
            return None

    def _predict_tflite(self, model_input: np.ndarray) -> np.ndarray | None:
        if self._tflite_interpreter is None:
            return None
        try:
            assert self._tflite_input_index is not None
            assert self._tflite_output_index is not None
            self._tflite_interpreter.set_tensor(self._tflite_input_index, model_input.astype(np.float32))
            self._tflite_interpreter.invoke()
            output = self._tflite_interpreter.get_tensor(self._tflite_output_index)[0]
            return np.asarray(output, dtype=np.float32)
        except Exception as exc:  # noqa: BLE001
            print(f"[inference] TFLite predict failed: {exc}")
            return None

    def predict(self, event: EventRecord) -> InferenceResult:
        self._load_models()
        model_input = self._event_to_window(event)

        h5_probs = self._predict_h5(model_input)
        tflite_probs = self._predict_tflite(model_input)

        if h5_probs is not None and tflite_probs is not None:
            w_h5, w_tflite = self._weights
            probs = h5_probs * w_h5 + tflite_probs * w_tflite
            model_version = f"{self._version}-h5+tflite"
        elif h5_probs is not None:
            probs = h5_probs
            model_version = f"{self._version}-h5"
        elif tflite_probs is not None:
            probs = tflite_probs
            model_version = f"{self._version}-tflite"
        else:
            # Fallback heuristic when model load failed.
            shock = abs(event.az - 9.81) + (abs(event.ax) + abs(event.ay)) * 0.35
            angular = abs(event.gx) + abs(event.gy) + abs(event.gz)
            score = shock + angular * 0.15
            if score >= 4.0:
                return InferenceResult(predicted_type="POTHOLE", confidence=0.82, model_version="heuristic-fallback")
            if score >= 2.2:
                return InferenceResult(predicted_type="SPEED_BUMP", confidence=0.72, model_version="heuristic-fallback")
            return InferenceResult(predicted_type="SMOOTH", confidence=0.90, model_version="heuristic-fallback")

        if probs.ndim != 1 or probs.shape[0] < 3:
            return InferenceResult(predicted_type="SMOOTH", confidence=0.50, model_version=f"{model_version}-invalid-output")

        class_id = int(np.argmax(probs))
        confidence = float(np.clip(probs[class_id], 0.0, 1.0))
        predicted_type = CLASS_NAMES.get(class_id, "SMOOTH")
        return InferenceResult(predicted_type=predicted_type, confidence=confidence, model_version=model_version)


_engine = EnsembleInferenceEngine()


def get_inference_status() -> dict[str, object]:
    return _engine.status()


def classify_event(event: EventRecord) -> InferenceResult:
    return _engine.predict(event)

