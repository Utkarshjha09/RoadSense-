import { supabase, Anomaly, Profile, RepairValidationStat, RoadStateClusterPoint } from './supabase'

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRadians = (value: number) => (value * Math.PI) / 180
    const earthRadiusKm = 6371
    const dLat = toRadians(lat2 - lat1)
    const dLon = toRadians(lon2 - lon1)
    const a =
        Math.sin(dLat / 2) ** 2
        + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return earthRadiusKm * c
}

function isValidAnomalyPoint(latitude: number, longitude: number) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false
    if (Math.abs(latitude) < 0.000001 && Math.abs(longitude) < 0.000001) return false
    return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
}

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
    return (data || []).filter((row: any) => isValidAnomalyPoint(Number(row.latitude), Number(row.longitude))) as Anomaly[]
}

// Get all anomalies with filters
export async function getAllAnomalies(filters?: {
    type?: string
    verified?: boolean
    limit?: number
}) {
    const { data, error } = await supabase.rpc('get_anomalies_in_viewport', {
        min_lat: -90,
        min_lng: -180,
        max_lat: 90,
        max_lng: 180,
        anomaly_type: filters?.type || null,
    })

    if (error) throw error

    let rows = (data || []).filter((row: any) => isValidAnomalyPoint(Number(row.latitude), Number(row.longitude)))
    if (filters?.verified !== undefined) {
        rows = rows.filter((row: any) => Boolean(row.verified) === filters.verified)
    }
    rows = rows.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    if (filters?.limit) {
        rows = rows.slice(0, filters.limit)
    }
    return rows as Anomaly[]
}

export async function getNearbyAnomalies(
    centerLat: number,
    centerLng: number,
    radiusKm: number,
    filters?: {
        type?: string
        verified?: boolean
        limit?: number
    }
) {
    const latDelta = radiusKm / 111
    const lonDelta = radiusKm / (111 * Math.max(Math.cos((centerLat * Math.PI) / 180), 0.01))
    const { data, error } = await supabase.rpc('get_anomalies_in_viewport', {
        min_lat: centerLat - latDelta,
        min_lng: centerLng - lonDelta,
        max_lat: centerLat + latDelta,
        max_lng: centerLng + lonDelta,
        anomaly_type: filters?.type || null,
    })
    if (error) throw error

    const nearby = (data || [])
        .filter((row: any) =>
            filters?.verified === undefined ? true : Boolean(row.verified) === filters.verified
        )
        .filter((row: any) => {
            const lat = Number(row.latitude)
            const lng = Number(row.longitude)
            if (!isValidAnomalyPoint(lat, lng)) {
                return false
            }
            return distanceKm(centerLat, centerLng, lat, lng) <= radiusKm
        })

    const sorted = nearby.sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    if (filters?.limit) {
        return sorted.slice(0, filters.limit) as Anomaly[]
    }

    return sorted as Anomaly[]
}

export async function getRecentImprovedAnomalies(limit = 8, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase.rpc('get_anomalies_in_viewport', {
        min_lat: -90,
        min_lng: -180,
        max_lat: 90,
        max_lng: 180,
        anomaly_type: null,
    })
    if (error) throw error

    return (data || [])
        .filter((row: any) => isValidAnomalyPoint(Number(row.latitude), Number(row.longitude)))
        .filter((row: any) => Boolean(row.verified))
        .filter((row: any) => new Date(row.updated_at).toISOString() >= since)
        .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, limit) as Anomaly[]
}

// Get anomaly statistics
export async function getAnomalyStats() {
    const { data, error } = await supabase.rpc('get_anomalies_in_viewport', {
        min_lat: -90,
        min_lng: -180,
        max_lat: 90,
        max_lng: 180,
        anomaly_type: null,
    })

    if (error) throw error

    const validRows = (data || []).filter((a: any) => isValidAnomalyPoint(Number(a.latitude), Number(a.longitude)))
    const total = validRows.length
    const potholes = validRows.filter((a: any) => a.type === 'POTHOLE').length
    const speedBumps = validRows.filter((a: any) => a.type === 'SPEED_BUMP').length
    const verified = validRows.filter((a: any) => a.verified).length

    return {
        total,
        potholes,
        speedBumps,
        verified,
        verificationRate: total > 0 ? (verified / total) * 100 : 0,
    }
}

export async function getRepairedSummary(days: 7 | 30 | 90 = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase.rpc('get_anomalies_in_viewport', {
        min_lat: -90,
        min_lng: -180,
        max_lat: 90,
        max_lng: 180,
        anomaly_type: null,
    })

    if (error) throw error

    const rows = (data || [])
        .filter((row: any) => isValidAnomalyPoint(Number(row.latitude), Number(row.longitude)))
        .filter((row: any) => new Date(row.created_at).toISOString() >= since)
    const total = rows.length
    const repairedRows = rows.filter((row: any) => row.verified)
    const repairedTotal = repairedRows.length
    const repairedPotholes = repairedRows.filter((row: any) => row.type === 'POTHOLE').length
    const repairedSpeedBumps = repairedRows.filter((row: any) => row.type === 'SPEED_BUMP').length

    return {
        total,
        repairedTotal,
        repairedPotholes,
        repairedSpeedBumps,
        repairedPercent: total > 0 ? (repairedTotal / total) * 100 : 0,
        pendingTotal: Math.max(total - repairedTotal, 0),
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
export async function updateUserRole(userId: string, role: 'driver' | 'owner' | 'admin') {
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

// Get repair validation status using post-repair next-N event window
export async function getRepairValidationStats(limit = 100) {
    const { data, error } = await supabase.rpc('get_repair_validation_stats', {
        p_limit: limit,
    })

    if (error) throw error
    return (data || []) as RepairValidationStat[]
}

// Get active road-state clusters (live flags) in viewport
export async function getActiveRoadStateInViewport(
    minLat: number,
    minLng: number,
    maxLat: number,
    maxLng: number,
    limit = 1000
) {
    const { data, error } = await supabase.rpc('get_active_road_state_in_viewport', {
        min_lat: minLat,
        min_lng: minLng,
        max_lat: maxLat,
        max_lng: maxLng,
        limit_count: limit,
    })

    if (error) throw error
    return (data || []) as RoadStateClusterPoint[]
}
