-- ============================================================================
-- RoadSense Database Setup Script
-- ============================================================================
-- Purpose: Complete Supabase database initialization with PostGIS support
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================================

-- ============================================================================
-- STEP 1: Enable PostGIS Extension
-- ============================================================================
-- PostGIS adds support for geographic objects (latitude/longitude)
-- This is CRITICAL for storing and querying location data efficiently

CREATE EXTENSION IF NOT EXISTS postgis;

-- Verify PostGIS installation
-- Expected output: PostGIS version number (e.g., "3.3.2")
SELECT PostGIS_Version();

-- ============================================================================
-- STEP 2: Create Profiles Table
-- ============================================================================
-- Extends Supabase Auth with additional user metadata
-- Links to auth.users via foreign key

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'driver' CHECK (role IN ('driver', 'admin')),
    score INTEGER DEFAULT 0, -- Gamification points for contributions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- ============================================================================
-- STEP 3: Create Anomalies Table
-- ============================================================================
-- Stores detected road anomalies with geospatial data

CREATE TABLE IF NOT EXISTS public.anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    -- Anomaly details
    type TEXT NOT NULL CHECK (type IN ('POTHOLE', 'SPEED_BUMP')),
    severity FLOAT NOT NULL CHECK (severity >= 0.0 AND severity <= 1.0),
    confidence FLOAT NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    
    -- Geospatial data (CRITICAL: Use GEOGRAPHY for accurate GPS calculations)
    -- SRID 4326 = WGS84 (standard GPS coordinate system)
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    
    -- Optional metadata
    image_url TEXT, -- URL to uploaded photo (if any)
    speed FLOAT, -- Vehicle speed at detection (m/s)
    verified BOOLEAN DEFAULT FALSE, -- Admin verification flag
    verification_count INTEGER DEFAULT 0, -- Number of users who confirmed this anomaly
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 4: Create Spatial Index (CRITICAL for Performance)
-- ============================================================================
-- GIST index enables fast geospatial queries (e.g., "find all potholes near me")
-- Without this, map queries will be EXTREMELY slow

CREATE INDEX IF NOT EXISTS idx_anomalies_location 
ON public.anomalies USING GIST(location);

-- Additional indexes for common queries
CREATE INDEX IF NOT EXISTS idx_anomalies_type ON public.anomalies(type);
CREATE INDEX IF NOT EXISTS idx_anomalies_created_at ON public.anomalies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_user_id ON public.anomalies(user_id);

-- ============================================================================
-- STEP 5: Row Level Security (RLS) Policies
-- ============================================================================
-- Enable RLS on both tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomalies ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Profiles Policies
-- ============================================================================

-- Policy 1: Users can read their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Policy 2: Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

-- Policy 3: Profiles are created automatically via trigger (see below)
CREATE POLICY "Profiles are created via trigger"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- Anomalies Policies
-- ============================================================================

-- Policy 1: PUBLIC READ - Anyone can view anomalies (for public map)
CREATE POLICY "Anyone can view anomalies"
ON public.anomalies
FOR SELECT
USING (true);

-- Policy 2: AUTHENTICATED INSERT - Only logged-in users can report anomalies
CREATE POLICY "Authenticated users can insert anomalies"
ON public.anomalies
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Policy 3: Users can update their own anomalies (e.g., add photo)
CREATE POLICY "Users can update own anomalies"
ON public.anomalies
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy 4: Only admins can delete anomalies
CREATE POLICY "Only admins can delete anomalies"
ON public.anomalies
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ============================================================================
-- STEP 6: Automatic Profile Creation Trigger
-- ============================================================================
-- When a user signs up via Supabase Auth, automatically create their profile

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 7: Geospatial RPC Function
-- ============================================================================
-- Function: get_anomalies_in_viewport
-- Purpose: Efficiently fetch anomalies within a map bounding box
-- Usage: SELECT * FROM get_anomalies_in_viewport(min_lat, min_lng, max_lat, max_lng)

CREATE OR REPLACE FUNCTION public.get_anomalies_in_viewport(
    min_lat FLOAT,
    min_lng FLOAT,
    max_lat FLOAT,
    max_lng FLOAT,
    anomaly_type TEXT DEFAULT NULL,
    limit_count INTEGER DEFAULT 1000
)
RETURNS TABLE (
    id UUID,
    type TEXT,
    severity FLOAT,
    confidence FLOAT,
    latitude FLOAT,
    longitude FLOAT,
    verified BOOLEAN,
    verification_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.type,
        a.severity,
        a.confidence,
        ST_Y(a.location::geometry) AS latitude,
        ST_X(a.location::geometry) AS longitude,
        a.verified,
        a.verification_count,
        a.created_at
    FROM public.anomalies a
    WHERE
        -- Bounding box filter (fast with GIST index)
        ST_Intersects(
            a.location,
            ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
        )
        -- Optional type filter
        AND (anomaly_type IS NULL OR a.type = anomaly_type)
    ORDER BY a.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- STEP 8: Helper Function - Calculate Nearby Anomalies
-- ============================================================================
-- Function: get_anomalies_near_point
-- Purpose: Find anomalies within X meters of a specific point
-- Usage: SELECT * FROM get_anomalies_near_point(28.7041, 77.1025, 500)

CREATE OR REPLACE FUNCTION public.get_anomalies_near_point(
    lat FLOAT,
    lng FLOAT,
    radius_meters FLOAT DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    type TEXT,
    severity FLOAT,
    distance_meters FLOAT,
    latitude FLOAT,
    longitude FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.type,
        a.severity,
        ST_Distance(
            a.location,
            ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
        ) AS distance_meters,
        ST_Y(a.location::geometry) AS latitude,
        ST_X(a.location::geometry) AS longitude
    FROM public.anomalies a
    WHERE
        ST_DWithin(
            a.location,
            ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
            radius_meters
        )
    ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- STEP 9: Insert Anomaly RPC Function (for Edge Function)
-- ============================================================================
-- Function: insert_anomaly
-- Purpose: Helper function for Edge Function to insert anomalies
-- Returns: UUID of newly created anomaly

CREATE OR REPLACE FUNCTION public.insert_anomaly(
    p_user_id UUID,
    p_type TEXT,
    p_severity FLOAT,
    p_confidence FLOAT,
    p_latitude FLOAT,
    p_longitude FLOAT,
    p_speed FLOAT DEFAULT NULL,
    p_image_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO public.anomalies (
        user_id,
        type,
        severity,
        confidence,
        location,
        speed,
        image_url
    ) VALUES (
        p_user_id,
        p_type,
        p_severity,
        p_confidence,
        ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
        p_speed,
        p_image_url
    )
    RETURNING id INTO new_id;
    
    RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 10: Update Timestamp Trigger
-- ============================================================================
-- Automatically update 'updated_at' column on row changes

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to profiles table
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Apply to anomalies table
DROP TRIGGER IF EXISTS update_anomalies_updated_at ON public.anomalies;
CREATE TRIGGER update_anomalies_updated_at
    BEFORE UPDATE ON public.anomalies
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 10: Sample Data (Optional - for testing)
-- ============================================================================
-- Uncomment to insert test data

/*
-- Insert test anomalies in Delhi, India
INSERT INTO public.anomalies (type, severity, confidence, location) VALUES
    ('POTHOLE', 0.92, 0.87, ST_SetSRID(ST_MakePoint(77.1025, 28.7041), 4326)::geography),
    ('SPEED_BUMP', 0.78, 0.91, ST_SetSRID(ST_MakePoint(77.2090, 28.6139), 4326)::geography),
    ('POTHOLE', 0.85, 0.82, ST_SetSRID(ST_MakePoint(77.3910, 28.5355), 4326)::geography);

-- Verify insertion
SELECT 
    id,
    type,
    severity,
    ST_Y(location::geometry) as latitude,
    ST_X(location::geometry) as longitude
FROM public.anomalies;
*/

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify the setup is correct

-- 1. Check PostGIS version
SELECT PostGIS_Version();

-- 2. List all tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 3. Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- 4. Test viewport function (Delhi area)
SELECT * FROM get_anomalies_in_viewport(28.4, 77.0, 28.8, 77.4);

-- ============================================================================
-- SETUP COMPLETE! 🎉
-- ============================================================================
-- Next steps:
-- 1. Note your Supabase project URL and anon key
-- 2. Configure mobile app with these credentials
-- 3. Deploy Edge Function (see upload-anomaly/index.ts)
-- ============================================================================
