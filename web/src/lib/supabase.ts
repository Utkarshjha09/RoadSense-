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
    role: 'driver' | 'owner' | 'admin'
    score: number
    created_at: string
    updated_at: string
}

export interface RepairValidationStat {
    repair_id: string
    cluster_id: string
    latitude: number
    longitude: number
    address_text: string | null
    marked_repaired_at: string
    sample_goal: number
    observed_events: number
    smooth_events: number
    pothole_events: number
    speed_bump_events: number
    remaining_events: number
    repaired_percent: number
    status_label: 'WAITING_DATA' | 'REPAIRED' | 'REMAINING_ISSUES'
    latest_event_at: string | null
}

export interface RoadStateClusterPoint {
    id: string
    current_state: 'SMOOTH' | 'POTHOLE' | 'SPEED_BUMP'
    confidence_score: number
    latitude: number
    longitude: number
    pothole_votes: number
    smooth_votes: number
    speed_bump_votes: number
    total_events: number
    last_event_at: string | null
}
