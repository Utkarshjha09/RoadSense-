# RoadSense

Crowdsourced road-quality monitoring: drive with the app running (phone sensors, or a paired ESP32 device) and it detects potholes and speed bumps in real time using an on-device deep-learning model, then syncs anonymized location + detection data to a shared backend so everyone can see where the problem areas are — and, optionally, so municipal teams get automatically alerted.

## What it does

- Detects potholes and speed bumps in real time from accelerometer/gyroscope data (50 Hz), either from the phone itself or a physical **ESP32** sensor streamed over WebSocket
- Runs a TCN-BiLSTM model on-device via TFLite (no network round-trip needed to classify a window)
- Also supports server-side inference (`backend/inference-service`) for heavier/aggregate processing
- Uploads anonymized GPS + detection data to Supabase (Postgres + PostGIS)
- Web admin dashboard to view, verify, and manage detections on a map
- Automated municipal alerting for high-severity, repeatedly-confirmed clusters (n8n workflow)
- Data-logger mode in the app to capture and label new training samples, and export them as CSV
- Works with intermittent connectivity — detections and uploads queue locally and sync when back online

## How it works

```
Mobile App (React Native / Expo)
  - Reads accelerometer/gyro at 50Hz (phone) or streams from a paired ESP32 over WebSocket
  - Runs the TFLite model on-device
  - Uploads detections with GPS coords to Supabase
  - Logger mode: capture + label windows, export CSV, queue anomaly CSVs for cloud upload
         |
         v
    Supabase (Postgres + PostGIS)
  - profiles, anomalies, sensor_events, road_state_clusters
  - RLS policies, spatial RPCs, OTP table, edge functions (upload-anomaly)
         |
         +--> cloud-api (FastAPI, Render)      -- event ingest + orchestration
         +--> inference-service (FastAPI)       -- server-side model inference
         +--> otp-service (Node/Express)        -- email OTP + contact form
         +--> n8n municipal-alert-agent         -- polls high-severity clusters, notifies municipalities
         |
         v
    Web Dashboard (React + Vite)
  - Map of all detections, verification workflow, reports, user management

ML Pipeline (Python/TensorFlow)
  - Trains the TCN-BiLSTM model from labeled IMU windows
  - Exports both a server-side .h5 model and a mobile .tflite model
```

## Repo structure

```
mobile/           React Native app (Expo) — see mobile/README.md
  app/            Screens: auth, home, driving, map, logger, analytics, settings, notifications, support, account
  src/services/   Sensor collection (phone + ESP32), TFLite inference, device connection config, Supabase client

web/              Admin dashboard (React + Vite) — see web/README.md
  src/pages/      Login, Dashboard, MapView, AnomalyManagement, Reports, UserManagement, Profile, About
  src/lib/        Supabase client + queries

backend/          Server side of the system — see backend/README.md
  supabase/       DB schema (migrations/), spatial RPCs, RLS, edge functions
  cloud-api/      FastAPI ingest/orchestration service (deployed via ../render.yaml)
  inference-service/  FastAPI service serving the trained model
  otp-service/    Node/Express email OTP + contact form service
  n8n/            Municipal alert automation workflow

ml-pipeline/      Python ML training — see ml-pipeline/README.md
  src/            train.py, model.py, preprocessing, dataset prep scripts
  models/final/   Exported road_sense_model.h5 (server) and .tflite (mobile)

raw_data/, raw_downloads/, models/   Top-level dataset/model working copies (large, gitignored where noted)
render.yaml        Render deployment config for cloud-api
```

## Tech stack

**Mobile:** Expo SDK 54, React Native 0.81, TypeScript, Expo Router, `react-native-fast-tflite`, `expo-sensors`/`expo-location`, AsyncStorage, native WebSocket (ESP32)

**Web:** React 18, Vite 5, TypeScript, Tailwind CSS, Leaflet / `@react-google-maps/api`, Recharts, React Query, Supabase JS (email/password + Google OAuth)

**Backend:** Supabase (PostgreSQL + PostGIS, RLS, edge functions), FastAPI (cloud-api, inference-service), Node/Express (otp-service), n8n (automation), Redis (cloud-api queueing)

**ML:** Python, TensorFlow/Keras, TCN-BiLSTM architecture, exports to `.h5` and `.tflite`

## Setup

**Requirements:**
- Node 18+
- Python 3.9+ (only needed for ML training or the Python backend services)
- Supabase account (free tier works)
- Physical Android phone (emulators/Expo Go don't expose real sensors) — optionally an ESP32 for external sensor streaming

**Quick start:**

1. Clone repo.
2. Supabase:
   - Create a project at supabase.com.
   - Run `backend/supabase/migrations/*.sql` in order (see `backend/README.md`) in the SQL editor.
   - Copy the project URL + anon key.
3. Mobile app:
   ```bash
   cd mobile
   npm install
   cp .env.example .env   # add Supabase + Google Maps creds
   npx expo run:android
   ```
   To use a physical ESP32 instead of the phone's own sensors, configure it in-app under **Settings → Device Connection** (IP + port) — see `mobile/ESP32_INTEGRATION.md`.
4. Web dashboard:
   ```bash
   cd web
   npm install
   cp .env.example .env   # add Supabase + Google Maps creds
   npm run dev
   ```
5. Backend services (optional — only needed for cloud/server-side inference, OTP email, or municipal alerts; the mobile app can run standalone against Supabase + on-device TFLite without them):
   ```bash
   cd backend/inference-service && pip install -r requirements.txt && uvicorn app.main:app --reload
   cd backend/cloud-api && docker compose up -d && pip install -r requirements.txt && uvicorn app.main:app --reload
   cd backend/otp-service && npm install && npm start
   ```
6. ML (optional — a trained model is already included in `ml-pipeline/models/final/`):
   ```bash
   cd ml-pipeline
   pip install -r requirements.txt
   python src/train.py
   ```

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for a detailed walkthrough and [CREDENTIALS_GUIDE.md](CREDENTIALS_GUIDE.md) for where each credential comes from.

## Components

### Mobile app
Field console for collecting sensor data and running detection, plus a full account/admin-lite experience:
- 50 Hz accelerometer/gyro sampling, phone or ESP32 (WebSocket) source — configurable and testable in-app
- On-device TFLite inference; auto-uploads detections with GPS
- Home dashboard shows **real** GPS/sensor connection status (not hardcoded) and real weekly stats
- Data logger for training-data capture/labeling/export, Analytics screen for trend review
- Settings (device connection, detection/sync/display preferences), Notifications, Help & Support
- Auth: email/password + role-based sign-up, 6-digit OTP verification, forgot/reset password — no bypass/demo login path

Main files: [app/driving.tsx](mobile/app/driving.tsx), [sensor.service.ts](mobile/src/services/sensor.service.ts), [tflite.service.ts](mobile/src/services/tflite.service.ts), [device-connection.service.ts](mobile/src/services/device-connection.service.ts)

More: [mobile/README.md](mobile/README.md)

### Web dashboard
View and manage collected data:
- Interactive map (Leaflet / Google Maps) with anomaly markers
- Filter/verify anomalies, reports view, admin-only user management
- Google OAuth or email/password sign-in

More: [web/README.md](web/README.md)

### Backend
Supabase is the source of truth; four services sit around it:
- **supabase/** — Postgres + PostGIS schema, spatial RPCs (`get_anomalies_in_viewport`, `get_anomalies_near_point`), RLS, `upload-anomaly` edge function
- **cloud-api/** — FastAPI ingest/orchestration service (Render-deployed, see `render.yaml`)
- **inference-service/** — FastAPI service that loads the trained model and serves predictions from IMU+GPS windows
- **otp-service/** — Node/Express email OTP + contact-form service
- **n8n/** — scheduled workflow that alerts municipal authorities about confirmed high-severity clusters

More: [backend/README.md](backend/README.md)

### ML pipeline
Trains the detection model:
- TCN-BiLSTM architecture (dilated Conv1D/TCN blocks + BiLSTM), ~150K params
- Input: 100-timestep sliding windows of accelerometer/gyro data (see `ml-pipeline/README.md` for the exact current feature set)
- Output: 3 classes (Smooth, Pothole, SpeedBump)
- Trained on the Kaggle Pothole Sensor Dataset plus supplementary road-condition data
- Exports both a `.h5` model (used by `inference-service`) and a `.tflite` model (~9 MB, used by the app)

More: [ml-pipeline/README.md](ml-pipeline/README.md)

## Current status

**Working:**
- Mobile app collects sensor data (phone or ESP32) and runs on-device detection
- Real (non-hardcoded) GPS/sensor status, device-connection configuration + test-connection flow
- Data uploads to Supabase with GPS coordinates
- Web dashboard shows detections on a map with verification workflow
- Server-side inference service and OTP/contact service
- Municipal alert automation for confirmed high-severity clusters

**TODO:**
- Background data collection (currently requires the app to be open/foregrounded)
- Formal accuracy/precision/recall reporting for the current trained model (see `ml-pipeline/ML.md`)
- Broader analytics/heatmaps in the web dashboard
- iOS build support (currently Android-first; iOS is intentionally excluded from EAS builds)

## Notes

- A trained model is already included in `ml-pipeline/models/final/` — training from scratch is optional.
- Sensor features need a physical device — emulators and Expo Go don't expose real accelerometer/gyro/GPS data.
- Check each subfolder's README for specifics; `SETUP_GUIDE.md` has the full setup walkthrough and `CREDENTIALS_GUIDE.md` explains every credential/env var and where to get it.
