const configuredContactServiceUrl = (import.meta.env.VITE_OTP_SERVICE_URL || '').trim()
const FALLBACK_CONTACT_SERVICE_URL = 'https://roadsense-otp-service.onrender.com'

export type ContactPayload = {
    name: string
    email: string
    subject: string
    company?: string
    message: string
    source?: 'web' | 'mobile'
    recaptchaToken?: string
}

function normalizeBaseUrl(value: string) {
    const trimmed = value.trim().replace(/\/+$/, '')
    return /^https?:\/\//i.test(trimmed) ? trimmed : ''
}

function buildCandidateServiceUrls() {
    const candidates: string[] = []
    const primary = normalizeBaseUrl(configuredContactServiceUrl)

    if (primary) {
        candidates.push(primary)
    } else {
        candidates.push(FALLBACK_CONTACT_SERVICE_URL)
    }

    if (import.meta.env.DEV) {
        candidates.push('http://localhost:4001')
    }

    return Array.from(new Set(candidates))
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 20000) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
    try {
        return await fetch(url, { ...options, signal: controller.signal })
    } finally {
        window.clearTimeout(timeout)
    }
}

export async function sendContactMessage(payload: ContactPayload) {
    const candidates = buildCandidateServiceUrls()
    const requestBody = JSON.stringify({
        ...payload,
        source: payload.source || 'web',
    })

    let lastError = 'Failed to send contact message'
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
            const message = error instanceof Error ? error.message : 'Failed to send contact message'
            lastError = `${message} (${baseUrl})`
        }
    }

    throw new Error(lastError)
}
