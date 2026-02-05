# RoadSense - Complete System Setup Guide

This guide walks you through setting up the entire RoadSense system from scratch.

## System Overview

RoadSense consists of three main components:
1. **Mobile App** (React Native/Expo) - Sensor data collection and real-time detection
2. **Backend** (Supabase) - Database, authentication, and API
3. **Web Dashboard** (React/Vite) - Admin interface for data management

---

## Prerequisites

- Node.js 18+ and npm
- Git
- Supabase account (free tier)
- Physical Android/iOS device (for mobile app testing)

---

## Part 1: Backend Setup (Supabase)

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign in and click "New Project"
3. Fill in:
   - Project name: `roadsense`
   - Database password: (save this!)
   - Region: Choose closest to you
4. Wait for project to be created (~2 minutes)

### 1.2 Get API Credentials

1. Go to **Settings → API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGci...`

### 1.3 Run Database Setup Script

1. Go to **SQL Editor** in Supabase dashboard
2. Click "New Query"
3. Copy the entire contents of `backend/supabase/migrations/001_setup.sql`
4. Paste and click "Run"
5. Verify success - you should see:
   - Tables: `profiles`, `anomalies`
   - Functions: `get_anomalies_in_viewport`, `get_anomalies_near_point`, `insert_anomaly`

### 1.4 Verify PostGIS

Run this query in SQL Editor:
```sql
SELECT PostGIS_Version();
```

Should return a version number (e.g., `3.3.2`).

---

## Part 2: Mobile App Setup

### 2.1 Install Dependencies

```bash
cd mobile
npm install
```

### 2.2 Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2.3 Run on Device

**Important:** You MUST use a physical device (sensors don't work in simulators)

**Android:**
```bash
npx expo run:android --device
```

**iOS:**
```bash
npx expo run:ios --device
```

**Note:** First build takes 5-10 minutes.

### 2.4 Test Mobile App

1. App should open automatically
2. Sign up with email/password
3. Go to "Start Driving"
4. Grant location permissions
5. Tap "Start Detection"
6. Verify sensor stats update (should show ~50 Hz)

---

## Part 3: Create Admin User

### 3.1 Sign Up via Mobile

1. Open mobile app
2. Sign up with your email (e.g., `admin@roadsense.com`)
3. Complete registration

### 3.2 Promote to Admin

1. Go to Supabase dashboard → **SQL Editor**
2. Run this query (replace with your email):
```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'admin@roadsense.com';
```

3. Verify:
```sql
SELECT email, role FROM profiles WHERE email = 'admin@roadsense.com';
```

Should show `role = 'admin'`.

---

## Part 4: Web Dashboard Setup

### 4.1 Install Dependencies

```bash
cd web
npm install
```

### 4.2 Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with the SAME Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4.3 Run Development Server

```bash
npm run dev
```

Dashboard will be at `http://localhost:3000`

### 4.4 Test Web Dashboard

1. Open `http://localhost:3000`
2. Click "🚀 Quick Login (Test)" button
   - OR manually enter: `admin@roadsense.com` / `admin123`
3. You should see the dashboard with:
   - Stats cards (Total anomalies, Potholes, Speed Bumps, Verified %)
   - Pie chart
   - Recent detections list

---

## Part 5: End-to-End Testing

### 5.1 Mobile → Backend → Web Flow

1. **Mobile App:**
   - Open app and sign in
   - Go to "Start Driving"
   - Tap "Start Detection"
   - Drive around (or shake phone to simulate)
   - Wait for a detection (mock inference will trigger randomly)
   - You should see vibration + detection in list

2. **Verify in Supabase:**
   - Go to Supabase dashboard → **Table Editor** → `anomalies`
   - You should see new rows appearing

3. **View in Web Dashboard:**
   - Refresh web dashboard
   - Go to "Map View" - markers should appear
   - Go to "Anomaly Management" - table should show detections
   - Click "Verify" button to mark as verified

### 5.2 Data Logger Testing

1. **Mobile App:**
   - Go to "Data Logger"
   - Tap "Start Collection"
   - Drive over a pothole/bump
   - Tap appropriate label button
   - Repeat 5-10 times
   - Tap "Export CSV"
   - Share file to your computer

2. **Verify CSV:**
   - Open CSV file
   - Should have columns: `timestamp, label, accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z`
   - Each labeled window should have 100 rows (2 seconds at 50Hz)

---

## Part 6: User Management

### 6.1 Create Additional Users

1. Sign up more users via mobile app
2. In web dashboard, go to "User Management"
3. You should see all users listed
4. Change roles using the dropdown (driver ↔ admin)

### 6.2 Test Role Permissions

1. Sign in to web dashboard with a non-admin account
2. You should see "Access Denied" message
3. Only admin users can access the dashboard

---

## Troubleshooting

### Mobile App Issues

**"Sensors not working"**
- Make sure you're using a physical device (not simulator)
- Use development build (`expo run:android/ios`)
- Expo Go has limited sensor access

**"Location permission denied"**
- Check `app.json` has correct permissions
- Manually enable in device settings: Settings → Apps → RoadSense → Permissions

**"Supabase connection failed"**
- Verify `.env` credentials are correct
- Check network connection
- Ensure database setup script was run

### Web Dashboard Issues

**"Cannot sign in"**
- Verify user has `role='admin'` in profiles table
- Check `.env` credentials match Supabase
- Clear browser cache and try again

**"Map not loading"**
- Check browser console for errors
- Verify Leaflet CSS is loaded in `index.html`
- Check network tab for failed requests

**"No data showing"**
- Ensure anomalies exist in database
- Check RLS policies allow access
- Verify RPC functions were created

### Backend Issues

**"RPC function not found"**
- Re-run `001_setup.sql` script
- Check SQL Editor for errors
- Verify functions exist: `SELECT * FROM pg_proc WHERE proname LIKE 'get_anomalies%';`

**"PostGIS not enabled"**
- Run: `CREATE EXTENSION IF NOT EXISTS postgis;`
- Restart Supabase project if needed

---

## Quick Reference

### Test Credentials

**Web Dashboard:**
- Email: `admin@roadsense.com`
- Password: `admin123`
- (Use quick login button for instant access)

### Important Commands

**Mobile:**
```bash
cd mobile
npm install
npx expo run:android --device
```

**Web:**
```bash
cd web
npm install
npm run dev
```

### Important Files

- Mobile env: `mobile/.env`
- Web env: `web/.env`
- Database setup: `backend/supabase/migrations/001_setup.sql`
- Credentials guide: `CREDENTIALS_GUIDE.md`

---

## Next Steps

1. ✅ Test end-to-end flow (mobile → backend → web)
2. ✅ Collect training data using Data Logger
3. 🚧 Integrate TFLite model (requires retraining without LSTM)
4. 🚧 Deploy web dashboard to Vercel/Netlify
5. 🚧 Add real-time updates (Supabase Realtime)
6. 🚧 Implement offline queue for mobile uploads

---

## Support

For issues or questions:
1. Check this setup guide
2. Review `CREDENTIALS_GUIDE.md`
3. Check component READMEs:
   - `mobile/README.md`
   - `web/README.md`
   - `backend/README.md`

---

## System Architecture

```
┌─────────────────┐
│   Mobile App    │
│  (React Native) │
│                 │
│  - Sensors      │
│  - GPS          │
│  - TFLite       │
└────────┬────────┘
         │
         │ Upload anomalies
         │ (Supabase RPC)
         ▼
┌─────────────────┐
│    Supabase     │
│   (Backend)     │
│                 │
│  - PostgreSQL   │
│  - PostGIS      │
│  - Auth         │
│  - RLS          │
└────────┬────────┘
         │
         │ Query data
         │ (Supabase Client)
         ▼
┌─────────────────┐
│  Web Dashboard  │
│   (React/Vite)  │
│                 │
│  - Analytics    │
│  - Map View     │
│  - CRUD         │
│  - User Mgmt    │
└─────────────────┘
```

---

**Status:** ✅ All components implemented and ready for testing!
