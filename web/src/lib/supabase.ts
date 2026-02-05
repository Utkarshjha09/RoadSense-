import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase credentials not found. Please configure .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Anomaly {
    id: string
    user_id: string | null
    type: 'POTHOLE' | 'SPEED_BUMP'
    severity: number
    confidence: number
    latitude: number
    longitude: number
    image_url: string | null
    speed: number | null
    verified: boolean
    verification_count: number
    created_at: string
    updated_at: string
}

export interface Profile {
    id: string
    email: string
    full_name: string | null
    role: 'driver' | 'admin'
    score: number
    created_at: string
    updated_at: string
}
