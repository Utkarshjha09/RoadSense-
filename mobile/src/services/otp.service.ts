import { NativeModules } from 'react-native'

const configuredOtpServiceUrl = (process.env.EXPO_PUBLIC_OTP_SERVICE_URL || '').trim()
const FALLBACK_OTP_SERVICE_URL = 'https://roadsense-otp-service.onrender.com'
const allowLocalOtpFallback = process.env.EXPO_PUBLIC_OTP_ALLOW_LOCAL === '1'
const OTP_REQUEST_TIMEOUT_MS = 20000

type OtpPurpose = 'login' | 'password_change'

export const isOtpConfigured = Boolean(normalizeBaseUrl(configuredOtpServiceUrl) || normalizeBaseUrl(FALLBACK_OTP_SERVICE_URL))

function normalizeBaseUrl(value: string) {
    const trimmed = value.trim().replace(/\/+$/, '')
    return /^https?:\/\//i.test(trimmed) ? trimmed : ''
}

function getDevScriptHost() {
    const scriptURL = NativeModules?.SourceCode?.scriptURL as string | undefined
    if (!scriptURL) return ''
    try {
        const url = new URL(scriptURL)
        return url.hostname || ''
    } catch {
        return ''
    }
}

function getServiceUrls() {
    const urls: string[] = []
    const primary = normalizeBaseUrl(configuredOtpServiceUrl)
    if (primary) {
        urls.push(primary)
    } else {
        urls.push(FALLBACK_OTP_SERVICE_URL)
    }

    if (__DEV__ && allowLocalOtpFallback) {
        const devHost = getDevScriptHost()
        if (devHost) urls.push(`http://${devHost}:4001`)

        urls.push('http://10.0.2.2:4001')
    }
    return Array.from(new Set(urls))
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = OTP_REQUEST_TIMEOUT_MS) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
        return await fetch(url, { ...options, signal: controller.signal })
    } finally {
        clearTimeout(timeout)
    }
}

async function request(path: string, body: Record<string, string>) {
    const candidates = getServiceUrls()
    if (candidates.length === 0) {
        throw new Error('OTP service is not configured in this build.')
    }
    let lastError = ''

    for (const baseUrl of candidates) {
        try {
            const response = await fetchWithTimeout(`${baseUrl}${path}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            })

            const payload = await response.json().catch(() => ({}))
            if (!response.ok) {
                throw new Error(payload.error || 'OTP request failed')
            }

            return payload
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                lastError = `Request timed out after ${OTP_REQUEST_TIMEOUT_MS / 1000}s`
            } else {
                lastError = error instanceof Error ? error.message : 'OTP request failed'
            }
        }
    }

    throw new Error(`OTP request failed. Tried: ${candidates.join(', ')}. Last error: ${lastError}`)
}

export async function sendOtp(email: string, purpose: OtpPurpose) {
    return request('/otp/send', { email, purpose })
}

export async function verifyOtp(email: string, otp: string, purpose: OtpPurpose) {
    return request('/otp/verify', { email, otp, purpose })
}
