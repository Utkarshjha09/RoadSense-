import AsyncStorage from '@react-native-async-storage/async-storage'

export type AppSettings = {
    aiDetection: boolean
    highPrecisionGps: boolean
    autoCloudSync: boolean
    hapticFeedback: boolean
    alertSounds: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
    aiDetection: true,
    highPrecisionGps: true,
    autoCloudSync: true,
    hapticFeedback: true,
    alertSounds: false,
}

const SETTINGS_KEY = 'roadsense:settings:v1'

export async function getAppSettings(): Promise<AppSettings> {
    try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY)
        if (!raw) return DEFAULT_SETTINGS
        const parsed = JSON.parse(raw)
        return { ...DEFAULT_SETTINGS, ...parsed }
    } catch (error) {
        console.warn('Failed to load settings:', error)
        return DEFAULT_SETTINGS
    }
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
    try {
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch (error) {
        console.warn('Failed to save settings:', error)
    }
}
