const otpServiceUrl = (import.meta.env.VITE_OTP_SERVICE_URL || 'http://localhost:4001').trim()

type OtpPurpose = 'login' | 'password_change'

async function request(path: string, body: Record<string, string>) {
    const response = await fetch(`${otpServiceUrl}${path}`, {
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
}

export async function sendOtp(email: string, purpose: OtpPurpose) {
    return request('/otp/send', { email, purpose })
}

export async function verifyOtp(email: string, otp: string, purpose: OtpPurpose) {
    return request('/otp/verify', { email, otp, purpose })
}
