from __future__ import annotations

from pathlib import Path
from threading import Lock

import numpy as np


CLASS_NAMES = {
    0: "Smooth",
    1: "Pothole",
    2: "SpeedBump",
}


class ModelRegistry:
    def __init__(self, model_path: Path) -> None:
        self.model_path = model_path
        self._model = None
        self._lock = Lock()

    def load(self):
        if self._model is not None:
            return self._model

        with self._lock:
            if self._model is None:
                if not self.model_path.exists():
                    raise FileNotFoundError(f"Model not found at {self.model_path}")

                import tensorflow as tf

                self._model = tf.keras.models.load_model(self.model_path)

        return self._model

    @property
    def ready(self) -> bool:
        return self._model is not None

    def predict(self, model_input: np.ndarray) -> tuple[int, float, str]:
        model = self.load()
        probabilities = model.predict(model_input, verbose=0)[0]
        class_id = int(np.argmax(probabilities))
        confidence = float(probabilities[class_id])
        return class_id, confidence, CLASS_NAMES[class_id]
