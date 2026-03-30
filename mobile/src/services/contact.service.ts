import { NativeModules } from 'react-native'

const configuredContactServiceUrl = (process.env.EXPO_PUBLIC_OTP_SERVICE_URL || '').trim()
const FALLBACK_CONTACT_SERVICE_URL = 'https://roadsense-otp-service.onrender.com'

export type ContactPayload = {
    name: string
    email: string
    subject?: string
    company?: string
    message: string
    source?: 'mobile' | 'web'
}

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

function buildCandidateServiceUrls() {
    const candidates: string[] = []
    const primary = normalizeBaseUrl(configuredContactServiceUrl)
    if (primary) {
        candidates.push(primary)
    } else {
        candidates.push(FALLBACK_CONTACT_SERVICE_URL)
    }

    if (__DEV__) {
        const devHost = getDevScriptHost()
        if (devHost) {
            candidates.push(`http://${devHost}:4001`)
        }

        // Android emulator local mapping fallback.
        candidates.push('http://10.0.2.2:4001')
    }

    return Array.from(new Set(candidates))
}

export const isContactConfigured = Boolean(normalizeBaseUrl(configuredContactServiceUrl) || normalizeBaseUrl(FALLBACK_CONTACT_SERVICE_URL))

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 25000) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
        return await fetch(url, { ...options, signal: controller.signal })
    } finally {
        clearTimeout(timeout)
    }
}

export async function sendContactMessage(payload: ContactPayload) {
    const candidates = buildCandidateServiceUrls()
    if (candidates.length === 0) {
        throw new Error('Contact service is not configured in this build.')
    }
    const requestBody = JSON.stringify({
        ...payload,
        // Keep both keys for compatibility with old/new backend payloads.
        subject: payload.subject || payload.company || '',
        company: payload.company || payload.subject || '',
        source: payload.source || 'mobile',
    })

    let lastNetworkError = ''
    for (const baseUrl of candidates) {
        try {
            const response = await fetchWithTimeout(`${baseUrl}/contact/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: requestBody,
            })

            const body = await response.json().catch(() => ({}))
            if (!response.ok) {
                throw new Error(body.error || `Request failed from ${baseUrl}`)
            }
            return body
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Network request failed'
            if (message.toLowerCase().includes('aborted')) {
                lastNetworkError = `${message} (server may still complete email delivery)`
            } else {
                lastNetworkError = message
            }
        }
    }

    throw new Error(
        `Network request failed. Tried: ${candidates.join(', ')}. Last error: ${lastNetworkError || 'Network request failed'}`
    )
}
