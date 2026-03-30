import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim()
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim()
const supabaseLogBucket = (process.env.EXPO_PUBLIC_SUPABASE_LOG_BUCKET || 'roadsense-logs').trim()
const fallbackUrl = 'https://placeholder.supabase.co'
const fallbackAnonKey = 'placeholder-anon-key'
const OFFLINE_ANOMALY_UPLOAD_KEY = 'roadsense_offline_anomaly_csv_uploads_v1'

function hasValidCoordinates(latitude: number, longitude: number) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false
    if (Math.abs(latitude) < 0.000001 && Math.abs(longitude) < 0.000001) return false
    return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
}

function hasPlaceholderConfig(value: string) {
    const normalized = value.toLowerCase()
    return (
        normalized.includes('your_project_ref') ||
        normalized.includes('your_supabase_anon_key') ||
        normalized.includes('placeholder')
    )
}

const hasValidSupabaseUrl = Boolean(supabaseUrl) && !hasPlaceholderConfig(supabaseUrl)
const hasValidSupabaseAnonKey = Boolean(supabaseAnonKey) && !hasPlaceholderConfig(supabaseAnonKey)

export const isSupabaseConfigured = hasValidSupabaseUrl && hasValidSupabaseAnonKey

export interface PendingAnomalyCsvUpload {
    fileUri: string
    fileName: string
    createdAt: string
}

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
        if (!hasValidCoordinates(data.latitude, data.longitude)) {
            return { success: false, error: new Error('Invalid GPS coordinates. Wait for a valid location fix and retry.') }
        }

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
        if (!hasValidCoordinates(data.latitude, data.longitude)) {
            return { success: false, error: new Error('Invalid GPS coordinates for sensor event upload') }
        }

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

export async function uploadAnomalyCsvFile(fileUri: string, fileName: string) {
    if (!isSupabaseConfigured) {
        return { success: false, error: new Error('Supabase not configured') }
    }

    try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError

        const userId = authData.user?.id
        if (!userId) {
            throw new Error('User not authenticated. Sign in before uploading CSV to Supabase.')
        }
        const day = new Date().toISOString().slice(0, 10)
        const path = `driving-csv/${userId}/${day}/${fileName}`

        const fileResponse = await fetch(fileUri)
        const blob = await fileResponse.blob()

        const { data, error } = await supabase.storage
            .from(supabaseLogBucket)
            .upload(path, blob, {
                contentType: 'text/csv',
                upsert: true,
            })

        if (error) throw error

        const { data: publicData } = supabase.storage
            .from(supabaseLogBucket)
            .getPublicUrl(path)

        return {
            success: true,
            path: data?.path || path,
            publicUrl: publicData?.publicUrl || null,
            bucket: supabaseLogBucket,
        }
    } catch (error) {
        console.error('Anomaly CSV upload error:', error)
        return { success: false, error }
    }
}

async function readPendingAnomalyCsvUploads(): Promise<PendingAnomalyCsvUpload[]> {
    try {
        const raw = await AsyncStorage.getItem(OFFLINE_ANOMALY_UPLOAD_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? (parsed as PendingAnomalyCsvUpload[]) : []
    } catch {
        return []
    }
}

async function writePendingAnomalyCsvUploads(items: PendingAnomalyCsvUpload[]) {
    await AsyncStorage.setItem(OFFLINE_ANOMALY_UPLOAD_KEY, JSON.stringify(items.slice(-500)))
}

export async function enqueueAnomalyCsvUpload(fileUri: string, fileName: string) {
    const current = await readPendingAnomalyCsvUploads()
    current.push({
        fileUri,
        fileName,
        createdAt: new Date().toISOString(),
    })
    await writePendingAnomalyCsvUploads(current)
}

export async function getPendingAnomalyCsvUploadCount() {
    const queue = await readPendingAnomalyCsvUploads()
    return queue.length
}

export async function flushPendingAnomalyCsvUploads() {
    const queue = await readPendingAnomalyCsvUploads()
    if (queue.length === 0) {
        return { uploaded: 0, remaining: 0, failed: false, errorMessage: null as string | null }
    }

    let uploaded = 0
    const remaining: PendingAnomalyCsvUpload[] = []
    let failed = false
    let errorMessage: string | null = null

    for (let i = 0; i < queue.length; i += 1) {
        const item = queue[i]
        const uploadedItem = await uploadAnomalyCsvFile(item.fileUri, item.fileName)
        if (uploadedItem.success) {
            uploaded += 1
            continue
        }

        failed = true
        if (uploadedItem.error instanceof Error) {
            errorMessage = uploadedItem.error.message
        } else if (typeof uploadedItem.error === 'string') {
            errorMessage = uploadedItem.error
        } else {
            errorMessage = 'Unknown upload error'
        }
        remaining.push(item, ...queue.slice(i + 1))
        break
    }

    await writePendingAnomalyCsvUploads(remaining)
    return { uploaded, remaining: remaining.length, failed, errorMessage }
}
