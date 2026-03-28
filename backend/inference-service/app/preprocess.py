from __future__ import annotations

import numpy as np
from scipy import signal

from .schemas import PredictWindowRequest


SAMPLING_RATE = 50
WINDOW_SIZE = 100
MODEL_FEATURE_COLUMNS = ("ax", "ay", "az", "gx", "gy", "gz")


def apply_high_pass_filter(data: np.ndarray, cutoff: float = 0.3, fs: int = 50, order: int = 4) -> np.ndarray:
    nyquist = 0.5 * fs
    normal_cutoff = cutoff / nyquist
    b, a = signal.butter(order, normal_cutoff, btype="high", analog=False)
    return signal.filtfilt(b, a, data, axis=0)
def preprocess_window(payload: PredictWindowRequest) -> np.ndarray:
    raw = np.asarray(
        [
            [
                sample.ax,
                sample.ay,
                sample.az,
                sample.gx,
                sample.gy,
                sample.gz,
            ]
            for sample in payload.samples
        ],
        dtype=np.float32,
    )

    processed = raw.copy()
    processed[:, 0:3] = apply_high_pass_filter(processed[:, 0:3], cutoff=0.3, fs=SAMPLING_RATE)
    return processed.reshape(1, WINDOW_SIZE, len(MODEL_FEATURE_COLUMNS)).astype(np.float32)


def representative_location(payload: PredictWindowRequest) -> tuple[float, float]:
    latitudes = [sample.latitude for sample in payload.samples]
    longitudes = [sample.longitude for sample in payload.samples]
    return float(np.median(latitudes)), float(np.median(longitudes))
