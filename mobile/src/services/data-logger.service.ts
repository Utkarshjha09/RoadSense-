import AsyncStorage from '@react-native-async-storage/async-storage'

export type LoggedSampleLabel = 'POTHOLE' | 'SPEED_BUMP' | 'NORMAL'

export interface LoggedSample {
  id: string
  timestamp: string
  label: LoggedSampleLabel
  source: 'driving' | 'logger'
  latitude?: number
  longitude?: number
  confidence?: number
  data?: number[][]
}

const LOGGER_SAMPLES_KEY = 'roadsense:logger:samples:v1'
const LOGGER_MAX_SAMPLES = 3000

export async function getLoggedSamples(): Promise<LoggedSample[]> {
  try {
    const raw = await AsyncStorage.getItem(LOGGER_SAMPLES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as LoggedSample[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch (error) {
    console.warn('Failed to load logged samples:', error)
    return []
  }
}

export async function appendLoggedSample(sample: LoggedSample): Promise<void> {
  try {
    const existing = await getLoggedSamples()
    const next = [...existing, sample].slice(-LOGGER_MAX_SAMPLES)
    await AsyncStorage.setItem(LOGGER_SAMPLES_KEY, JSON.stringify(next))
  } catch (error) {
    console.warn('Failed to append logged sample:', error)
  }
}

export async function clearLoggedSamples(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LOGGER_SAMPLES_KEY)
  } catch (error) {
    console.warn('Failed to clear logged samples:', error)
  }
}

