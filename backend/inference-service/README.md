# RoadSense Cloud Inference Service

FastAPI service for cloud pothole inference. It accepts sensor windows from:

- mobile phone sensors
- ESP32 + IMU + GPS hardware

The service:

1. validates the incoming 100-sample window
2. applies the same preprocessing assumptions used in training
3. runs the TensorFlow `.h5` model on the server
4. stores detected anomalies in Supabase
5. returns the predicted road condition back to the caller

## Structure

```text
backend/inference-service/
├── app/
│   ├── config.py
│   ├── main.py
│   ├── model_loader.py
│   ├── preprocess.py
│   ├── schemas.py
│   └── supabase_client.py
├── .env.example
├── README.md
└── requirements.txt
```

## Setup

```bash
cd backend/inference-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Fill in:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Run locally

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

or on Windows:

```powershell
.\start.ps1
```

## Endpoints

### `GET /health`

Returns service and model readiness state.

### `POST /predict-window`

Request body:

```json
{
  "source": "phone",
  "user_id": "optional-user-uuid",
  "device_id": "optional-device-id",
  "samples": [
    {
      "timestamp": 1710000000000,
      "ax": 0.12,
      "ay": -0.03,
      "az": 9.71,
      "gx": 0.01,
      "gy": -0.02,
      "gz": 0.03,
      "latitude": 23.0777,
      "longitude": 76.8392,
      "speed_kmh": 38.5
    }
  ]
}
```

Response body:

```json
{
  "class_id": 1,
  "class_name": "Pothole",
  "confidence": 0.94,
  "window_size": 100,
  "source": "phone",
  "representative_location": {
    "latitude": 23.0777,
    "longitude": 76.8392
  },
  "stored_anomaly_id": "uuid-or-null",
  "stored": true,
  "sensor_event_id": "uuid-or-null",
  "cluster_id": "uuid-or-null",
  "cluster_state": "POTHOLE",
  "cluster_confidence": 0.91,
  "cluster_active": true,
  "window_log_id": "uuid-or-null"
}
```

## Notes

- The current model expects 8 features per sample:
  - `ax, ay, az, gx, gy, gz, latitude, longitude`
- Windows should be sampled at about `50 Hz`
- One prediction window should contain `100` samples
- For ESP32 standalone mode, use:
  - ESP32
  - IMU with accelerometer + gyroscope
  - GPS module

## Mobile integration plan

Once this service is deployed, the mobile app should:

1. collect a 100-sample rolling window
2. send the window to `/predict-window`
3. receive `Smooth / Pothole / SpeedBump`
4. show live road-status guidance
5. read stored anomalies from Supabase for route-quality planning

## Oracle Cloud

Deployment notes are in [ORACLE_CLOUD_SETUP.md](./ORACLE_CLOUD_SETUP.md).

## Docker build

Build from the repo root so Docker can include the trained model:

```bash
docker build -f backend/inference-service/Dockerfile -t roadsense-inference .
```

## Current inference contract

The current deployed `.h5` model accepts only 6 IMU features per sample:

- `ax`
- `ay`
- `az`
- `gx`
- `gy`
- `gz`

GPS is still required in each request, but it is used for:

- representative event location
- road-state clustering
- anomaly storage
- map and route logic

The `/predict-window` response now also includes aggregation fields:

- `sensor_event_id`
- `cluster_id`
- `cluster_state`
- `cluster_confidence`
- `cluster_active`
- `window_log_id`

## Automatic flag lifecycle (3000-pass rule)

Road flags are stored as road-state clusters in Supabase. On each new event:

1. cluster state is refreshed from recent votes
2. if latest `3000` events at that location are mostly smooth (<=5% issue events), the flag is auto-deactivated

This means repaired roads are removed from active map flags automatically after enough vehicle passes.
