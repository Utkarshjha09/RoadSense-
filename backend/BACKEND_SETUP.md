# RoadSense Backend Setup Guide

## Prerequisites
- Supabase account (free tier)
- Git (for version control)

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign in with GitHub
4. Click "New Project"
5. Fill in details:
   - **Name:** `roadsense`
   - **Database Password:** (generate strong password - SAVE THIS!)
   - **Region:** Choose closest to your location (e.g., `ap-south-1` for India)
   - **Pricing Plan:** Free
6. Click "Create new project"
7. Wait 2-3 minutes for provisioning

## Step 2: Run Database Setup Script

1. In Supabase Dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Copy the entire contents of `backend/supabase/migrations/001_setup.sql`
4. Paste into the SQL Editor
5. Click **"Run"** (or press Ctrl+Enter)
6. Verify success:
   - You should see "Success. No rows returned" for most commands
   - Check for any error messages (red text)

### Verification Queries

Run these one by one to verify setup:

```sql
-- Check PostGIS is installed
SELECT PostGIS_Version();
-- Expected: "3.3.2" or similar

-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
-- Expected: anomalies, profiles

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
-- Expected: Both tables should have rowsecurity = true

-- Test RPC function
SELECT * FROM get_anomalies_in_viewport(28.4, 77.0, 28.8, 77.4);
-- Expected: Empty result (no data yet) or test data if you uncommented sample inserts
```

## Step 3: Get API Credentials

1. Go to **Settings** → **API** (left sidebar)
2. Copy these values (you'll need them for mobile/web apps):
   - **Project URL:** `https://xxxxx.supabase.co`
   - **anon public key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long string)
   - **service_role key:** (keep this SECRET - only for server-side)

## Step 4: Deploy Edge Function (Optional)

### Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Windows (PowerShell)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Linux
brew install supabase/tap/supabase
```

### Login and Deploy

```bash
# Login to Supabase
supabase login

# Link to your project
cd backend
supabase link --project-ref <your-project-ref>

# Deploy the function
supabase functions deploy upload-anomaly

# Test the function
curl -i --location --request POST 'https://<project-ref>.supabase.co/functions/v1/upload-anomaly' \
  --header 'Authorization: Bearer <anon-key>' \
  --header 'Content-Type: application/json' \
  --data '{"latitude":28.7041,"longitude":77.1025,"type":"POTHOLE","severity":0.92,"confidence":0.87}'
```

## Step 5: Configure Mobile App

Create `mobile/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Step 6: Test with Sample Data

Run this in SQL Editor to insert test anomalies:

```sql
-- Insert test anomalies in Delhi
INSERT INTO public.anomalies (type, severity, confidence, location) VALUES
    ('POTHOLE', 0.92, 0.87, ST_SetSRID(ST_MakePoint(77.1025, 28.7041), 4326)::geography),
    ('SPEED_BUMP', 0.78, 0.91, ST_SetSRID(ST_MakePoint(77.2090, 28.6139), 4326)::geography),
    ('POTHOLE', 0.85, 0.82, ST_SetSRID(ST_MakePoint(77.3910, 28.5355), 4326)::geography);

-- Verify
SELECT 
    type,
    severity,
    ST_Y(location::geometry) as latitude,
    ST_X(location::geometry) as longitude
FROM public.anomalies;
```

## Database Schema Overview

### Tables

**profiles**
- `id` (UUID) - Links to auth.users
- `email` (TEXT)
- `full_name` (TEXT)
- `role` (TEXT) - 'driver' or 'admin'
- `score` (INTEGER) - Gamification points

**anomalies**
- `id` (UUID)
- `user_id` (UUID) - Foreign key to profiles
- `type` (TEXT) - 'POTHOLE' or 'SPEED_BUMP'
- `severity` (FLOAT) - 0.0 to 1.0
- `confidence` (FLOAT) - 0.0 to 1.0
- `location` (GEOGRAPHY) - GPS coordinates
- `image_url` (TEXT) - Optional photo
- `verified` (BOOLEAN)
- `verification_count` (INTEGER)

### RPC Functions

**get_anomalies_in_viewport(min_lat, min_lng, max_lat, max_lng)**
- Returns all anomalies within bounding box
- Used by map to load visible markers

**get_anomalies_near_point(lat, lng, radius_meters)**
- Returns anomalies within X meters of a point
- Used for "nearby warnings" feature

**insert_anomaly(...)**
- Helper function for Edge Function
- Validates and inserts new anomaly

## Security (RLS Policies)

- ✅ **Public Read:** Anyone can view anomalies
- ✅ **Authenticated Insert:** Only logged-in users can report
- ✅ **Own Update:** Users can update their own reports
- ✅ **Admin Delete:** Only admins can delete data

## Troubleshooting

### PostGIS not found
```sql
-- Enable manually
CREATE EXTENSION IF NOT EXISTS postgis;
```

### RLS blocking inserts
```sql
-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'anomalies';

-- Temporarily disable RLS for testing (NOT for production!)
ALTER TABLE public.anomalies DISABLE ROW LEVEL SECURITY;
```

### Edge Function errors
```bash
# View logs
supabase functions logs upload-anomaly

# Check environment variables
supabase secrets list
```

## Next Steps

1. ✅ Database setup complete
2. ➡️ Configure mobile app with Supabase credentials
3. ➡️ Test anomaly upload from mobile
4. ➡️ Build web dashboard to visualize data

## Free Tier Limits

- **Database:** 500 MB storage
- **Bandwidth:** 2 GB/month
- **Edge Functions:** 500K invocations/month
- **Auth:** 50,000 monthly active users

For RoadSense, this should be sufficient for:
- ~100,000 anomaly records
- ~1,000 active users
- ~10,000 daily API requests
