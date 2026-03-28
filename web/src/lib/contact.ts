const contactServiceUrl = (import.meta.env.VITE_OTP_SERVICE_URL || 'http://localhost:4001').trim()

export type ContactPayload = {
    name: string
    email: string
    subject: string
    company?: string
    message: string
    source?: 'web' | 'mobile'
    recaptchaToken?: string
}

export async function sendContactMessage(payload: ContactPayload) {
    const response = await fetch(`${contactServiceUrl}/contact/send`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            ...payload,
            source: payload.source || 'web',
        }),
    })

    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
        throw new Error(body.error || 'Failed to send contact message')
    }

    return body
}
