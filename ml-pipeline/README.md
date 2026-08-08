# RoadSense ML Pipeline

Python/TensorFlow pipeline that trains the road-condition classification model (TCN-BiLSTM) used on-device (TFLite) and by `backend/inference-service`.

## 1. Setup

```bash
pip install -r requirements.txt
```

## 2. Data preparation

Sources: Kaggle Pothole Sensor Dataset (smartphone accelerometer/gyroscope, ~50 Hz) plus additional road-condition CSVs — see `colab_instructions.md` for dataset links, or use `src/download_datasets.py`.

1. Place raw CSV files in `raw_data/`.
2. The training script expects the common schema: `timestamp, ax, ay, az, gx, gy, gz, label` (`src/prepare_kaggle_data.py` / `src/unify_datasets.py` normalize source datasets into this shape).
3. `label`: `0` = Smooth, `1` = Pothole, `2` = SpeedBump.

## 3. Model

TCN-BiLSTM hybrid, ~150K parameters (`src/model.py`):

```
Input (100 timesteps x 6 features: ax, ay, az, gx, gy, gz)
  -> 4x dilated Conv1D/TCN blocks (dilations 1,2,4,8; 64 filters, kernel 3) + SpatialDropout
  -> Bidirectional LSTM (64 units)
  -> Dense(32, relu) -> Dropout(0.5)
  -> Dense(3, softmax)  # Smooth / Pothole / SpeedBump
```

Preprocessing (`src/preprocessing.py`): Butterworth high-pass filter (order 4, 0.3 Hz cutoff) on accelerometer channels, sliding window (size 100, step 50 — 50% overlap), per-channel standardization.

> Note: the current `raw_data/` mix is accelerometer/gyro-only (no GPS-labeled speed-bump samples in the base Kaggle set) — some app-side docs describe an 8-feature (with lat/lng) variant; check `src/train.py` for the exact feature set actually being trained before assuming parity with a previously exported model.

## 4. Training

```bash
cd src
python train.py
```

- If no data is found in `raw_data/`, it generates **synthetic data** for pipeline verification only (not for a production model).
- Saves the Keras model to `models/final/road_sense_model.h5` (also consumed directly by `backend/inference-service`).
- Exports a mobile-optimized model to `models/final/road_sense_model.tflite` (consumed by `mobile/src/services/tflite.service.ts`).

Evaluate a trained model with `python evaluate_model.py` or `python test_model.py`; see `TEST_RESULTS.md` for the latest recorded run. `demo_real_world.py` runs inference against a sample real-world clip.

## 5. Key files

| File | Purpose |
|---|---|
| `src/model.py` | TCN-BiLSTM Keras model definition |
| `src/preprocessing.py` | Filtering, sliding window, feature extraction |
| `src/train.py` | Main loop: load → split → train → save → convert to TFLite |
| `src/download_datasets.py` | Fetches source datasets |
| `src/prepare_kaggle_data.py`, `src/unify_datasets.py` | Normalize raw sources into the common schema |
| `src/test_tflite_model.py` | Sanity-check the exported `.tflite` model |
| `evaluate_model.py`, `test_model.py` | Accuracy/metrics reporting on the `.h5` model |
| `demo_real_world.py` | Run the model against a real recorded sample |

See `ML.md` for architecture rationale and open TODOs (e.g. formal precision/recall/F1 reporting), and `colab_instructions.md` for training on Google Colab.

## Output

`models/final/`:
- `road_sense_model.h5` — Keras model, used by `backend/inference-service` (also baked into its Docker image)
- `road_sense_model.tflite` — mobile-optimized export, used by the Expo app
