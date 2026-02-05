import { supabase, Anomaly, Profile } from './supabase'

// Get anomalies in viewport
export async function getAnomaliesInViewport(
    minLat: number,
    minLng: number,
    maxLat: number,
    maxLng: number,
    type?: string
) {
    const { data, error } = await supabase.rpc('get_anomalies_in_viewport', {
        min_lat: minLat,
        min_lng: minLng,
        max_lat: maxLat,
        max_lng: maxLng,
        anomaly_type: type || null,
    })

    if (error) throw error
    return data as Anomaly[]
}

// Get all anomalies with filters
export async function getAllAnomalies(filters?: {
    type?: string
    verified?: boolean
    limit?: number
}) {
    let query = supabase
        .from('anomalies')
        .select('*')
        .order('created_at', { ascending: false })

    if (filters?.type) {
        query = query.eq('type', filters.type)
    }

    if (filters?.verified !== undefined) {
        query = query.eq('verified', filters.verified)
    }

    if (filters?.limit) {
        query = query.limit(filters.limit)
    }

    const { data, error } = await query
    if (error) throw error
    return data as Anomaly[]
}

// Get anomaly statistics
export async function getAnomalyStats() {
    const { data, error } = await supabase
        .from('anomalies')
        .select('type, verified, created_at')

    if (error) throw error

    const total = data.length
    const potholes = data.filter((a) => a.type === 'POTHOLE').length
    const speedBumps = data.filter((a) => a.type === 'SPEED_BUMP').length
    const verified = data.filter((a) => a.verified).length

    return {
        total,
        potholes,
        speedBumps,
        verified,
        verificationRate: total > 0 ? (verified / total) * 100 : 0,
    }
}

// Verify anomaly
export async function verifyAnomaly(id: string) {
    const { error } = await supabase
        .from('anomalies')
        .update({ verified: true, verification_count: 1 })
        .eq('id', id)

    if (error) throw error
}

// Delete anomaly
export async function deleteAnomaly(id: string) {
    const { error } = await supabase.from('anomalies').delete().eq('id', id)
    if (error) throw error
}

// Get all users
export async function getAllUsers() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) throw error
    return data as Profile[]
}

// Update user role
export async function updateUserRole(userId: string, role: 'driver' | 'admin') {
    const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId)

    if (error) throw error
}

// Get user contributions
export async function getUserContributions(userId: string) {
    const { data, error } = await supabase
        .from('anomalies')
        .select('*')
        .eq('user_id', userId)

    if (error) throw error
    return data as Anomaly[]
}
