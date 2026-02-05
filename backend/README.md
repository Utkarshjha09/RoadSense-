# RoadSense Backend

Supabase-based backend infrastructure for RoadSense pothole detection system.

## Structure

```
backend/
├── supabase/
│   ├── migrations/
│   │   └── 001_setup.sql          # Complete database schema
│   └── functions/
│       └── upload-anomaly/
│           └── index.ts            # Edge Function for anomaly uploads
└── BACKEND_SETUP.md                # Step-by-step setup guide
```

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
- ✅ Spatial GIST index for fast map queries
- ✅ Row Level Security (RLS) policies

### RPC Functions
- `get_anomalies_in_viewport(min_lat, min_lng, max_lat, max_lng)` - Fetch anomalies in bounding box
- `get_anomalies_near_point(lat, lng, radius_meters)` - Find nearby anomalies
- `insert_anomaly(...)` - Helper for Edge Function

### Edge Functions
- `upload-anomaly` - Serverless API for mobile app uploads

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
