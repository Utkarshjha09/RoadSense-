import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim()
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim()
const fallbackUrl = 'https://placeholder.supabase.co'
const fallbackAnonKey = 'placeholder-anon-key'

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
    console.warn('Supabase credentials not found. Running in guest mode.')
}

export const supabase = createClient(
    isSupabaseConfigured ? supabaseUrl : fallbackUrl,
    isSupabaseConfigured ? supabaseAnonKey : fallbackAnonKey,
    {
        auth: {
            storage: AsyncStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
        },
    }
)

// Upload anomaly to backend
export async function uploadAnomaly(data: {
    latitude: number
    longitude: number
    type: 'POTHOLE' | 'SPEED_BUMP'
    severity: number
    confidence: number
    speed?: number
}) {
    if (!isSupabaseConfigured) {
        return { success: false, error: new Error('Supabase not configured') }
    }

    try {
        const { data: result, error } = await supabase.rpc('insert_anomaly', {
            p_user_id: (await supabase.auth.getUser()).data.user?.id,
            p_type: data.type,
            p_severity: data.severity,
            p_confidence: data.confidence,
            p_latitude: data.latitude,
            p_longitude: data.longitude,
            p_speed: data.speed || null,
            p_image_url: null,
        })

        if (error) throw error
        return { success: true, id: result }
    } catch (error) {
        console.error('Upload error:', error)
        return { success: false, error }
    }
}

// Get anomalies in viewport
export async function getAnomaliesInViewport(
    minLat: number,
    minLng: number,
    maxLat: number,
    maxLng: number
) {
    if (!isSupabaseConfigured) {
        return { success: false, error: new Error('Supabase not configured') }
    }

    try {
        const { data, error } = await supabase.rpc('get_anomalies_in_viewport', {
            min_lat: minLat,
            min_lng: minLng,
            max_lat: maxLat,
            max_lng: maxLng,
        })

        if (error) throw error
        return { success: true, data }
    } catch (error) {
        console.error('Fetch error:', error)
        return { success: false, error }
    }
}

// Upload prediction event into continuous road-state aggregation pipeline
export async function uploadSensorEvent(data: {
    source: 'phone' | 'esp32'
    predictedType: 'SMOOTH' | 'POTHOLE' | 'SPEED_BUMP'
    confidence: number
    sampleCount?: number
    latitude: number
    longitude: number
    deviceId?: string | null
}) {
    if (!isSupabaseConfigured) {
        return { success: false, error: new Error('Supabase not configured') }
    }

    try {
        const { data: authData } = await supabase.auth.getUser()
        const userId = authData.user?.id || null

        const { data: result, error } = await supabase.rpc('record_sensor_event', {
            p_user_id: userId,
            p_source: data.source,
            p_device_id: data.deviceId ?? null,
            p_predicted_type: data.predictedType,
            p_confidence: data.confidence,
            p_sample_count: data.sampleCount ?? 100,
            p_latitude: data.latitude,
            p_longitude: data.longitude,
            p_cluster_radius_meters: 12,
        })

        if (error) throw error
        return { success: true, data: result }
    } catch (error) {
        console.error('Sensor event upload error:', error)
        return { success: false, error }
    }
}
