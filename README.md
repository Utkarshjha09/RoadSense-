# RoadSense

Crowdsourced road quality monitoring using phone sensors + deep learning.

Basically, you drive around with the app running, and it automatically detects potholes and bad roads using your phone's accelerometer/gyroscope. Data gets uploaded to a map so everyone can see where the problem areas are.

## What it does

- Detects potholes and bumps in real-time using phone sensors (50Hz sampling)
- Uses a TCN-BiLSTM model running on-device (TFLite)
- Uploads anonymized GPS + sensor data to Supabase
- Web dashboard to view/manage detected anomalies
- Works offline, syncs later

## How it works

```
Mobile App (React Native)
  - Reads accelerometer/gyro at 50Hz
  - Runs TFLite model locally
  - Uploads detections with GPS coords
         |
         v
    Supabase Backend
  - PostgreSQL + PostGIS
  - Stores locations + anomaly data
         |
         v
    Web Dashboard (React)
  - View map of all detections
  - Filter/verify anomalies
  - Basic analytics

ML Pipeline (Python/TensorFlow)
  - Train TCN-BiLSTM model with geospatial features
  - 95.89% accuracy on test set
  - Export to .tflite for mobile
```



## Repo structure

```
mobile/           - React Native app (Expo)
  app/            - Screens (auth, driving, logger)
  src/services/   - Sensor collection, TFLite, Supabase client

web/              - Admin dashboard (React + Vite)
  src/pages/      - Dashboard, map view, management
  src/lib/        - Supabase queries

backend/          - Supabase config
  supabase/migrations/  - SQL schema (PostGIS setup)
  supabase/functions/   - Edge functions

ml-pipeline/      - Python ML training
  src/            - train.py, model.py, preprocessing
  models/final/   - Exported .tflite model

raw_downloads/    - Training datasets (Kaggle stuff)
```



## Tech stack

**Mobile:** React Native (Expo 54), TypeScript, react-native-fast-tflite, expo-sensors

**Web:** React 18, Vite, Tailwind, Leaflet maps, Recharts, React Query

**Backend:** Supabase (PostgreSQL + PostGIS), RLS policies, edge functions

**ML:** Python, TensorFlow/Keras, TCN-BiLSTM model, exports to .tflite



## Setup

**Requirements:**
- Node 18+
- Python 3.9+ (if training model)
- Supabase account (free tier works)
- Physical phone (emulators don't have real sensors)

**Quick start:**

1. Clone repo
2. Set up Supabase:
   - Create project on supabase.com
   - Run `backend/supabase/migrations/001_setup.sql` in SQL editor
   - Copy your project URL + anon key

3. Mobile app:
   ```bash
   cd mobile
   npm install
   cp .env.example .env  # add your Supabase creds
   npx expo run:android
   ```

4. Web dashboard:
   ```bash
   cd web
   npm install
   cp .env.example .env  # add your Supabase creds
   npm run dev
   ```

5. ML (optional - model already included):
   ```bash
   cd ml-pipeline
   pip install -r requirements.txt
   python src/train.py
   ```

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for more details.



## Components

### Mobile App
Collects sensor data and runs detection:
- 50Hz accelerometer/gyro sampling
- Gravity filtering for clean data
- TFLite model runs on-device
- Auto-uploads detections with GPS
- Logger mode for collecting training data

Main files: [app/driving.tsx](mobile/app/driving.tsx), [sensor.service.ts](mobile/src/services/sensor.service.ts), [tflite.service.ts](mobile/src/services/tflite.service.ts)

More: [mobile/README.md](mobile/README.md)

### Web Dashboard
View and manage collected data:
- Interactive Leaflet map
- Filter anomalies by type/status/date
- Verify detections (real vs false positive)
- User management

More: [web/README.md](web/README.md)

### Backend
Supabase (PostgreSQL + PostGIS):
- Stores anomalies with lat/lng as GEOGRAPHY type
- Spatial queries: `get_anomalies_in_viewport()`, `get_anomalies_near_point()`
- RLS policies for data security
- Auth handled by Supabase

More: [backend/README.md](backend/README.md)

### ML Pipeline
Train the detection model:
- TCN-BiLSTM architecture with geospatial features
- Input: 100 timesteps x 8 features (ax,ay,az,gx,gy,gz,latitude,longitude)
- Output: 3 classes (Smooth, Pothole, SpeedBump)
- 95.89% accuracy, 100% speed bump detection
- Trained on 4,676 samples from 6 datasets (250K+ raw points)
- Exports to .tflite (~9MB)

More: [ml-pipeline/README.md](ml-pipeline/README.md)



## Current status

Working:
- Mobile app collects sensor data + runs detection
- TFLite model works on-device
- Data uploads to Supabase with GPS coords
- Web dashboard shows detections on map
- Basic filtering/management

TODO:
- Background data collection (currently need app open)
- Better analytics/heatmaps
- Model improvements using prod data
- Performance tuning

## Notes

- Model is trained on Kaggle + real-world datasets with GPS coordinates, included in `models/final/`
- Model includes geospatial awareness (latitude/longitude) for location-based detection
- Need physical device to test - emulators don't have real sensors
- Check individual READMEs in each folder for more specific info
- See `SETUP_GUIDE.md` for detailed setup walkthrough
