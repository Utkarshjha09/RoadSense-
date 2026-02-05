import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase credentials not found. Please configure .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
})

// Upload anomaly to backend
export async function uploadAnomaly(data: {
    latitude: number
    longitude: number
    type: 'POTHOLE' | 'SPEED_BUMP'
    severity: number
    confidence: number
    speed?: number
}) {
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
