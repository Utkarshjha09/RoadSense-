# RoadSense Backend

Backend infrastructure for RoadSense: a Supabase (Postgres + PostGIS) database at the core, plus four independent services around it. Each service folder has its own README/setup doc — this file is the index.

## Structure

```
backend/
├── supabase/            Database schema, RPCs, RLS, edge functions (the source of truth)
├── cloud-api/            FastAPI service: event ingest + orchestration, deployed on Render (see ../render.yaml)
├── inference-service/    FastAPI service: loads the trained model and serves predictions
├── otp-service/          Node/Express service: email OTP + contact form
├── n8n/                  n8n workflow: municipal alert automation
└── BACKEND_SETUP.md      Step-by-step Supabase setup guide
```

## Services at a glance

| Service | Stack | Purpose |
|---|---|---|
| `supabase/` | Postgres + PostGIS, SQL, Edge Functions (Deno) | Schema, spatial queries, RLS, auth, `upload-anomaly` edge function |
| `cloud-api/` | Python, FastAPI, Redis, Postgres | Ingests sensor events (`app/api/events.py`), orchestrates inference + queueing; `/health` reports model readiness. Deployed via `render.yaml` (root of repo) |
| `inference-service/` | Python, FastAPI, TensorFlow | Loads `ml-pipeline/models/final/road_sense_model.h5`, exposes `POST /predict-window` (100-sample IMU + GPS window → Smooth/Pothole/SpeedBump + confidence), writes results to Supabase |
| `otp-service/` | Node.js, Express | `POST /otp/send`, `POST /otp/verify` (email OTP via SMTP/Resend, backed by `email_otp_verifications` table), `POST /contact/send` (contact form), reCAPTCHA verification |
| `n8n/` | n8n workflow JSON | `municipal-alert-agent.workflow.json` — runs every 5 min, calls the `get_municipal_alert_candidates` RPC, and notifies municipal authorities about high-severity clusters |

## Quick Start

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create new project (free tier)

2. **Run Database Setup**
   - Open SQL Editor in Supabase Dashboard
   - Copy/paste contents of `supabase/migrations/001_setup.sql`
   - Click "Run"

3. **Get API Credentials**
   - Settings → API
   - Copy Project URL and anon key
   - Add to mobile app `.env` file

4. **Deploy Edge Function** (Optional)
   ```bash
   supabase login
   supabase link --project-ref <your-ref>
   supabase functions deploy upload-anomaly
   ```

## Features

### Database
- ✅ PostGIS extension for geospatial queries
- ✅ `profiles` table (user management)
- ✅ `anomalies` table with GEOGRAPHY column
- ✅ `sensor_events` table for raw prediction history
- ✅ `road_state_clusters` table for live road truth per location
- ✅ Spatial GIST index for fast map queries
- ✅ Row Level Security (RLS) policies

### RPC Functions
- `get_anomalies_in_viewport(min_lat, min_lng, max_lat, max_lng)` - Fetch anomalies in bounding box
- `get_anomalies_near_point(lat, lng, radius_meters)` - Find nearby anomalies
- `insert_anomaly(...)` - Helper for Edge Function
- `record_sensor_event(...)` - Store one prediction event and refresh the location cluster
- `get_active_road_state_in_viewport(...)` - Fetch current clustered road-state markers

### Edge Functions
- `upload-anomaly` - Serverless API for mobile app uploads

### Cloud Inference
- `inference-service` - FastAPI service that receives IMU + GPS windows, runs the trained model, and stores anomalies in Supabase

## Migrations (backend/supabase/migrations/)

Applied in order:

1. `001_setup.sql` — initial schema (profiles, anomalies, PostGIS, RLS)
2. `002_add_owner_role.sql` — owner/admin role support
3. `003_create_email_otp_verifications.sql` — OTP table used by `otp-service`
4. `004_add_road_state_aggregation.sql` — raw `sensor_events` + live `road_state_clusters`
5. `005_fix_record_sensor_event_cluster_id_ambiguity.sql` — bugfix
6. `006_add_municipal_alert_agent.sql` — support for the n8n municipal alert workflow
7. `007_add_repair_validation_stats.sql` — repair-validation stats
8. `008_add_window_logs_and_auto_flag_resolution.sql` — sensor window logging + auto-flag resolution ("3000-pass rule")

## Running each service locally

```bash
# cloud-api — needs local Postgres + Redis (docker-compose.yml provides both)
cd cloud-api && docker compose up -d && pip install -r requirements.txt && uvicorn app.main:app --reload

# inference-service — needs ml-pipeline/models/final/road_sense_model.h5 present
cd inference-service && pip install -r requirements.txt && uvicorn app.main:app --reload

# otp-service
cd otp-service && npm install && npm start
```

Each service reads its own `.env` (see `.env.example` where present). Key variable names:

- **cloud-api**: `DATABASE_URL`, `REDIS_URL`, `API_SECRET`, `MODEL_PATH`, `CORS_ALLOWED_ORIGINS`, `ENVIRONMENT`, `ALLOW_DEV_ENDPOINTS`
- **inference-service**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **otp-service**: `PORT`, `FRONTEND_URL`/`FRONTEND_URLS`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `OTP_FROM_EMAIL`, `CONTACT_TO_EMAIL`, `RECAPTCHA_SECRET_KEY`, `OTP_EXPIRY_MINUTES`, `RESEND_API_KEY`, `RESEND_API_BASE_URL`

## API Endpoints

### Upload Anomaly
```
POST https://<project-ref>.supabase.co/functions/v1/upload-anomaly
Authorization: Bearer <anon-key>
Content-Type: application/json

{
  "latitude": 28.7041,
  "longitude": 77.1025,
  "type": "POTHOLE",
  "severity": 0.92,
  "confidence": 0.87,
  "speed": 15.5,
  "image_url": "https://..."
}
```

### Get Anomalies in Viewport
```sql
SELECT * FROM get_anomalies_in_viewport(28.4, 77.0, 28.8, 77.4);
```

## Security

- **Public Read**: Anyone can view anomalies (for public map)
- **Authenticated Insert**: Only logged-in users can report
- **Own Update**: Users can update their own reports
- **Admin Delete**: Only admins can delete

## Free Tier Limits

- 500 MB database storage
- 2 GB bandwidth/month
- 500K Edge Function invocations/month
- 50,000 monthly active users

## Documentation

See [BACKEND_SETUP.md](./BACKEND_SETUP.md) for detailed setup instructions.
