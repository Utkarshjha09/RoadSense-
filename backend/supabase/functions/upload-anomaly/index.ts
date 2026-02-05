// ============================================================================
// RoadSense Upload Anomaly Edge Function
// ============================================================================
// Purpose: Serverless API endpoint to receive anomaly reports from mobile app
// Deploy: supabase functions deploy upload-anomaly
// URL: https://<project-ref>.supabase.co/functions/v1/upload-anomaly
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers for mobile app requests
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================================================
// Request Validation Schema
// ============================================================================
interface AnomalyRequest {
    latitude: number
    longitude: number
    type: 'POTHOLE' | 'SPEED_BUMP'
    severity: number
    confidence: number
    speed?: number
    image_url?: string
}

function validateRequest(data: any): { valid: boolean; error?: string; payload?: AnomalyRequest } {
    // Check required fields
    if (!data.latitude || !data.longitude || !data.type || !data.severity || !data.confidence) {
        return { valid: false, error: 'Missing required fields: latitude, longitude, type, severity, confidence' }
    }

    // Validate latitude (-90 to 90)
    if (data.latitude < -90 || data.latitude > 90) {
        return { valid: false, error: 'Invalid latitude: must be between -90 and 90' }
    }

    // Validate longitude (-180 to 180)
    if (data.longitude < -180 || data.longitude > 180) {
        return { valid: false, error: 'Invalid longitude: must be between -180 and 180' }
    }

    // Validate type
    if (!['POTHOLE', 'SPEED_BUMP'].includes(data.type)) {
        return { valid: false, error: 'Invalid type: must be POTHOLE or SPEED_BUMP' }
    }

    // Validate severity (0.0 to 1.0)
    if (data.severity < 0 || data.severity > 1) {
        return { valid: false, error: 'Invalid severity: must be between 0.0 and 1.0' }
    }

    // Validate confidence (0.0 to 1.0)
    if (data.confidence < 0 || data.confidence > 1) {
        return { valid: false, error: 'Invalid confidence: must be between 0.0 and 1.0' }
    }

    return {
        valid: true,
        payload: {
            latitude: data.latitude,
            longitude: data.longitude,
            type: data.type,
            severity: data.severity,
            confidence: data.confidence,
            speed: data.speed || null,
            image_url: data.image_url || null,
        }
    }
}

// ============================================================================
// Main Handler
// ============================================================================
serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Initialize Supabase client
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: req.headers.get('Authorization')! },
                },
            }
        )

        // Get authenticated user
        const {
            data: { user },
            error: authError,
        } = await supabaseClient.auth.getUser()

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized: Please log in' }),
                {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        // Parse request body
        const requestData = await req.json()

        // Validate request
        const validation = validateRequest(requestData)
        if (!validation.valid) {
            return new Response(
                JSON.stringify({ error: validation.error }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        const payload = validation.payload!

        // Insert anomaly into database
        // Use PostGIS ST_MakePoint to create GEOGRAPHY point
        const { data, error } = await supabaseClient.rpc('insert_anomaly', {
            p_user_id: user.id,
            p_type: payload.type,
            p_severity: payload.severity,
            p_confidence: payload.confidence,
            p_latitude: payload.latitude,
            p_longitude: payload.longitude,
            p_speed: payload.speed,
            p_image_url: payload.image_url,
        })

        if (error) {
            console.error('Database error:', error)
            return new Response(
                JSON.stringify({ error: 'Failed to save anomaly', details: error.message }),
                {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        // Success response
        return new Response(
            JSON.stringify({
                success: true,
                message: 'Anomaly reported successfully',
                anomaly_id: data,
            }),
            {
                status: 201,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )

    } catch (error) {
        console.error('Unexpected error:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    }
})

// ============================================================================
// Helper RPC Function (Add to setup.sql)
// ============================================================================
/*
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
*/
