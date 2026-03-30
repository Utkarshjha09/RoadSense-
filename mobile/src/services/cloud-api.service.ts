import AsyncStorage from '@react-native-async-storage/async-storage'

export type CloudSensorSourceType = 'phone' | 'esp32'

type IngestMode = 'live' | 'sync'

export interface CloudSensorEvent {
    event_id: string
    device_id: string
    source: CloudSensorSourceType
    timestamp: string
    lat: number
    lng: number
    ax: number
    ay: number
    az: number
    gx: number
    gy: number
    gz: number
    speed?: number
}

export interface CloudPredictionItem {
    event_id: string
    predicted_type: 'SMOOTH' | 'POTHOLE' | 'SPEED_BUMP'
    confidence: number
    model_version: string
    created_at: string
    device_id: string
    source: CloudSensorSourceType
    event_ts: string
    lat: number
    lng: number
}

interface CloudReading {
    ax: number
    ay: number
    az: number
    gx: number
    gy: number
    gz: number
    timestamp: number
    latitude: number
    longitude: number
}

const CLOUD_API_BASE = (
    process.env.EXPO_PUBLIC_CLOUD_API_URL
    || process.env.EXPO_PUBLIC_API_BASE_URL
    || ''
).trim().replace(/\/+$/, '')
const API_SECRET = (process.env.EXPO_PUBLIC_API_SECRET || '').trim()
const OFFLINE_QUEUE_KEY = 'roadsense_cloud_offline_events_v1'
const MAX_QUEUE_EVENTS = 5000
const SYNC_CHUNK_SIZE = 100
const REQUEST_TIMEOUT_MS = 20000

let cachedDeviceId: string | null = null
let localCounter = 0
let flushing = false

export const isCloudApiConfigured = Boolean(CLOUD_API_BASE)

function makeEventId(deviceId: string, timestampMs: number): string {
    localCounter = (localCounter + 1) % 1000000
    return `${deviceId}-${timestampMs}-${localCounter}`
}

function randomId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}

async function getDeviceId(): Promise<string> {
    if (cachedDeviceId) return cachedDeviceId
    const key = 'roadsense_cloud_device_id'
    const existing = (await AsyncStorage.getItem(key))?.trim()
    if (existing) {
        cachedDeviceId = existing
        return existing
    }
    const generated = randomId('device')
    await AsyncStorage.setItem(key, generated)
    cachedDeviceId = generated
    return generated
}

async function readOfflineQueue(): Promise<CloudSensorEvent[]> {
    try {
        const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? (parsed as CloudSensorEvent[]) : []
    } catch {
        return []
    }
}

async function writeOfflineQueue(events: CloudSensorEvent[]): Promise<void> {
    const trimmed = events.slice(-MAX_QUEUE_EVENTS)
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(trimmed))
}

async function enqueueOffline(events: CloudSensorEvent[]): Promise<void> {
    if (events.length === 0) return
    const current = await readOfflineQueue()
    await writeOfflineQueue([...current, ...events])
}

function getErrorMessage(body: any): string | null {
    if (!body || typeof body !== 'object') return null
    if (typeof body.error === 'string' && body.error.trim()) return body.error.trim()
    if (typeof body.detail === 'string' && body.detail.trim()) return body.detail.trim()
    return null
}

async function postBatch(path: string, events: CloudSensorEvent[]): Promise<{ ok: boolean; body?: any; status?: number; error?: string }> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
        const response = await fetch(`${CLOUD_API_BASE}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(API_SECRET ? { 'x-api-secret': API_SECRET } : {}),
            },
            body: JSON.stringify({ events }),
            signal: controller.signal,
        })
        let body: any = null
        try {
            body = await response.json()
        } catch {
            body = null
        }
        if (!response.ok) {
            const reason = getErrorMessage(body) || `HTTP ${response.status}`
            return { ok: false, body, status: response.status, error: reason }
        }
        return { ok: true, body, status: response.status }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Network request failed'
        return { ok: false, error: message }
    } finally {
        clearTimeout(timeout)
    }
}

export async function buildCloudEvent(source: CloudSensorSourceType, reading: CloudReading): Promise<CloudSensorEvent> {
    const deviceId = await getDeviceId()
    const timestampMs = Number(reading.timestamp) || Date.now()
    return {
        event_id: makeEventId(deviceId, timestampMs),
        device_id: deviceId,
        source,
        timestamp: new Date(timestampMs).toISOString(),
        lat: reading.latitude,
        lng: reading.longitude,
        ax: reading.ax,
        ay: reading.ay,
        az: reading.az,
        gx: reading.gx,
        gy: reading.gy,
        gz: reading.gz,
    }
}

export async function submitLiveEvents(events: CloudSensorEvent[]): Promise<{ success: boolean; queueError?: string | null }> {
    if (events.length === 0) return { success: true }
    if (!isCloudApiConfigured) return { success: false, queueError: 'Set EXPO_PUBLIC_CLOUD_API_URL or EXPO_PUBLIC_API_BASE_URL' }

    const result = await postBatch('/v1/events/batch', events)
    if (result.ok) {
        return { success: true, queueError: result.body?.queue_error ?? null }
    }
    await enqueueOffline(events)
    const reason = result.error || (result.status ? `HTTP ${result.status}` : 'network timeout/unreachable')
    return { success: false, queueError: `Live upload failed (${reason}); queued for retry` }
}

export async function flushOfflineEvents(): Promise<void> {
    if (!isCloudApiConfigured || flushing) return
    flushing = true
    try {
        let queue = await readOfflineQueue()
        while (queue.length > 0) {
            const chunk = queue.slice(0, SYNC_CHUNK_SIZE)
            const result = await postBatch('/v1/sync/batch', chunk)
            if (!result.ok) {
                break
            }
            queue = queue.slice(chunk.length)
            await writeOfflineQueue(queue)
        }
    } finally {
        flushing = false
    }
}

export async function fetchLatestPredictions(limit = 20): Promise<CloudPredictionItem[]> {
    if (!isCloudApiConfigured) return []
    const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)))
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
        const response = await fetch(`${CLOUD_API_BASE}/v1/predictions/latest?limit=${safeLimit}`, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                ...(API_SECRET ? { 'x-api-secret': API_SECRET } : {}),
            },
            signal: controller.signal,
        })
        if (!response.ok) return []
        const body = await response.json()
        return Array.isArray(body?.items) ? (body.items as CloudPredictionItem[]) : []
    } catch {
        return []
    } finally {
        clearTimeout(timeout)
    }
}
