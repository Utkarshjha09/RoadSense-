import AsyncStorage from '@react-native-async-storage/async-storage'

export type SensorSourceType = 'phone' | 'esp32'
export type Esp32ConnectionState = 'idle' | 'connecting' | 'connected' | 'error'

export type DeviceConnectionConfig = {
    sensorSource: SensorSourceType
    esp32Host: string
    esp32Port: string
}

const CONFIG_KEY = 'roadsense:device-connection:v1'
const STATE_KEY = 'roadsense:device-connection:state:v1'
const TEST_TIMEOUT_MS = 6000

export const DEFAULT_DEVICE_CONNECTION: DeviceConnectionConfig = {
    sensorSource: 'phone',
    esp32Host: '192.168.4.1',
    esp32Port: '81',
}

export function buildEsp32WebSocketUrl(config: Pick<DeviceConnectionConfig, 'esp32Host' | 'esp32Port'>): string {
    const host = config.esp32Host.trim()
    const port = config.esp32Port.trim()
    if (!host) return ''
    return port ? `ws://${host}:${port}` : `ws://${host}`
}

export async function getDeviceConnectionConfig(): Promise<DeviceConnectionConfig> {
    try {
        const raw = await AsyncStorage.getItem(CONFIG_KEY)
        if (!raw) return DEFAULT_DEVICE_CONNECTION
        return { ...DEFAULT_DEVICE_CONNECTION, ...JSON.parse(raw) }
    } catch (error) {
        console.warn('Failed to load device connection config:', error)
        return DEFAULT_DEVICE_CONNECTION
    }
}

export async function saveDeviceConnectionConfig(config: DeviceConnectionConfig): Promise<void> {
    try {
        await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config))
    } catch (error) {
        console.warn('Failed to save device connection config:', error)
    }
}

export async function getEsp32ConnectionState(): Promise<{ state: Esp32ConnectionState; updatedAt: number | null }> {
    try {
        const raw = await AsyncStorage.getItem(STATE_KEY)
        if (!raw) return { state: 'idle', updatedAt: null }
        return JSON.parse(raw)
    } catch (error) {
        console.warn('Failed to load ESP32 connection state:', error)
        return { state: 'idle', updatedAt: null }
    }
}

export async function setEsp32ConnectionState(state: Esp32ConnectionState): Promise<void> {
    try {
        await AsyncStorage.setItem(STATE_KEY, JSON.stringify({ state, updatedAt: Date.now() }))
    } catch (error) {
        console.warn('Failed to persist ESP32 connection state:', error)
    }
}

/**
 * Briefly opens a WebSocket to the given URL to verify the ESP32 is reachable,
 * then closes it. Does not affect an in-progress driving/logging session.
 */
export function testEsp32Connection(url: string): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
        if (!url.trim()) {
            resolve({ success: false, message: 'Enter an IP address first.' })
            return
        }

        let settled = false
        let socket: WebSocket
        try {
            socket = new WebSocket(url)
        } catch (error) {
            resolve({ success: false, message: error instanceof Error ? error.message : 'Invalid WebSocket URL' })
            return
        }

        const finish = (result: { success: boolean; message: string }) => {
            if (settled) return
            settled = true
            clearTimeout(timeout)
            try {
                socket.close()
            } catch {
                // ignore
            }
            resolve(result)
        }

        const timeout = setTimeout(() => {
            finish({ success: false, message: 'Timed out waiting for a response.' })
        }, TEST_TIMEOUT_MS)

        socket.onopen = () => {
            finish({ success: true, message: 'Connected to ESP32.' })
        }

        socket.onerror = () => {
            finish({ success: false, message: 'Could not reach the device at that address.' })
        }
    })
}
