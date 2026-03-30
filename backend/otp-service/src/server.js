import crypto from 'crypto'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const {
  PORT = '4001',
  HOST = '0.0.0.0',
  FRONTEND_URL = 'http://localhost:3000',
  FRONTEND_URLS = '',
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SMTP_HOST,
  SMTP_PORT = '587',
  SMTP_SECURE = 'false',
  SMTP_USER,
  SMTP_PASS,
  OTP_FROM_EMAIL,
  CONTACT_TO_EMAIL,
  RECAPTCHA_SECRET_KEY,
  OTP_EXPIRY_MINUTES = '10',
  RESEND_API_KEY = '',
  RESEND_API_BASE_URL = 'https://api.resend.com',
} = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

if (!OTP_FROM_EMAIL) {
  throw new Error('OTP_FROM_EMAIL is required')
}

const usingResendApi = Boolean(RESEND_API_KEY)
if (!usingResendApi && (!SMTP_HOST || !SMTP_USER || !SMTP_PASS)) {
  throw new Error('Either RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS must be configured')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const app = express()

const allowedOrigins = Array.from(
  new Set(
    [FRONTEND_URL, ...FRONTEND_URLS.split(',')]
      .map((s) => s.trim())
      .filter(Boolean)
  )
)

function normalizeOrigin(origin) {
  try {
    const url = new URL(origin)
    const host = url.hostname.replace(/^www\./i, '')
    return `${url.protocol}//${host}${url.port ? `:${url.port}` : ''}`
  } catch {
    return origin
  }
}

const allowedOriginSet = new Set([
  ...allowedOrigins,
  ...allowedOrigins.map((origin) => normalizeOrigin(origin)),
])

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true)
    if (allowedOriginSet.has(origin) || allowedOriginSet.has(normalizeOrigin(origin))) {
      return cb(null, true)
    }
    console.error(`CORS blocked for origin: ${origin}. Allowed: ${Array.from(allowedOriginSet).join(', ')}`)
    return cb(new Error(`CORS blocked for origin: ${origin}`))
  },
  credentials: true,
}))
app.use(express.json())

const transporter = usingResendApi
  ? null
  : nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: SMTP_SECURE === 'true',
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })

if (usingResendApi) {
  console.log('Email provider: Resend API')
} else if (transporter) {
  transporter.verify()
    .then(() => {
      console.log('SMTP connection verified')
    })
    .catch((error) => {
      console.error('SMTP verification failed:', error)
    })
}

async function sendEmail({ from, to, subject, text, html, replyTo }) {
  if (usingResendApi) {
    const response = await fetch(`${RESEND_API_BASE_URL}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        text,
        html,
        reply_to: replyTo || undefined,
      }),
    })

    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      const resendError = body?.message || body?.error || `HTTP ${response.status}`
      throw new Error(`Resend API send failed: ${resendError}`)
    }

    return body
  }

  if (!transporter) {
    throw new Error('No email provider available')
  }

  return transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
    replyTo,
  })
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex')
}

function normalizePurpose(value) {
  return value === 'login' ? 'login' : 'password_change'
}

function sanitizeContactValue(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

async function verifyRecaptchaToken(token, remoteIp) {
  if (!RECAPTCHA_SECRET_KEY) {
    return { ok: true, skipped: true }
  }

  if (!token) {
    return { ok: false, reason: 'Captcha token is required' }
  }

  const body = new URLSearchParams({
    secret: RECAPTCHA_SECRET_KEY,
    response: token,
  })

  if (remoteIp) {
    body.set('remoteip', remoteIp)
  }

  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const result = await response.json()
  if (!response.ok || !result?.success) {
    return { ok: false, reason: 'Captcha verification failed' }
  }

  return { ok: true, skipped: false }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/otp/send', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const purpose = normalizePurpose(req.body?.purpose)

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    console.log(`OTP send requested for ${email} (${purpose})`)

    const otp = generateOtp()
    const otpHash = hashOtp(otp)
    const expiresAt = new Date(Date.now() + Number(OTP_EXPIRY_MINUTES) * 60 * 1000).toISOString()

    const { error: deleteError } = await supabase
      .from('email_otp_verifications')
      .delete()
      .eq('email', email)
      .eq('purpose', purpose)
      .is('verified_at', null)

    if (deleteError) {
      console.error('OTP delete failed:', deleteError)
      return res.status(500).json({ error: `Supabase delete failed: ${deleteError.message}` })
    }

    const { error: insertError } = await supabase
      .from('email_otp_verifications')
      .insert({
        email,
        purpose,
        otp_hash: otpHash,
        expires_at: expiresAt,
      })

    if (insertError) {
      console.error('OTP insert failed:', insertError)
      return res.status(500).json({ error: `Supabase insert failed: ${insertError.message}` })
    }

    await sendEmail({
      from: OTP_FROM_EMAIL,
      to: email,
      subject: purpose === 'login' ? 'Your RoadSense login OTP' : 'Your RoadSense password change OTP',
      text: [
        'Your verification code is:',
        otp,
        '',
        `This code will expire in ${OTP_EXPIRY_MINUTES} minutes.`,
        '',
        "If you didn't request this verification, please ignore this email.",
      ].join('\n'),
      html: `
        <div style="background:#f3f3f3;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;color:#2f2f2f">
          <div style="max-width:640px;margin:0 auto;background:#f3f3f3">
            <p style="margin:0 0 20px 0;font-size:30px;line-height:1.2;font-weight:700;color:#2f2f2f">
              Your verification code is:
            </p>
            <p style="margin:0 0 26px 0;font-size:56px;line-height:1.05;letter-spacing:4px;font-weight:700;color:#f4511e">
              ${otp}
            </p>
            <p style="margin:0 0 18px 0;font-size:28px;line-height:1.35;color:#2f2f2f">
              This code will expire in ${OTP_EXPIRY_MINUTES} minutes.
            </p>
            <p style="margin:0;font-size:28px;line-height:1.35;color:#2f2f2f">
              If you didn't request this verification, please ignore this email.
            </p>
          </div>
        </div>
      `,
    })
  } catch (error) {
    console.error('OTP email send failed:', error)
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to send OTP email' })
  }

  return res.json({ ok: true })
})

app.post('/contact/send', async (req, res) => {
  try {
    const name = sanitizeContactValue(req.body?.name, 'RoadSense User')
    const email = sanitizeContactValue(req.body?.email).toLowerCase()
    const source = sanitizeContactValue(req.body?.source, 'web')
    const subject = sanitizeContactValue(req.body?.subject, source === 'mobile' ? 'Mobile Contact Request' : '')
    const company = sanitizeContactValue(req.body?.company, 'Not provided')
    const message = sanitizeContactValue(req.body?.message)
    const recaptchaToken = sanitizeContactValue(req.body?.recaptchaToken)

    if (!email || !subject || !message) {
      return res.status(400).json({ error: 'Email, subject, and message are required' })
    }

    if (source !== 'mobile') {
      const captchaResult = await verifyRecaptchaToken(recaptchaToken, req.ip)
      if (!captchaResult.ok) {
        return res.status(400).json({ error: captchaResult.reason })
      }
    }

    const destination = sanitizeContactValue(CONTACT_TO_EMAIL, OTP_FROM_EMAIL)
    const submittedAt = new Date().toISOString()

    await sendEmail({
      from: OTP_FROM_EMAIL,
      to: destination,
      replyTo: email,
      subject: `[RoadSense Contact] ${subject} | ${name} (${source})`,
      text: [
        'New RoadSense contact request',
        `Name: ${name}`,
        `Email: ${email}`,
        `Subject: ${subject}`,
        `Company/Project: ${company}`,
        `Source: ${source}`,
        `Submitted: ${submittedAt}`,
        '',
        'Message:',
        message,
      ].join('\n'),
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#0f172a;max-width:640px">
          <h2 style="margin:0 0 12px 0;color:#0b3a53">New RoadSense Contact Request</h2>
          <table style="border-collapse:collapse;width:100%;margin-bottom:16px">
            <tr><td style="padding:6px 0"><strong>Name</strong></td><td>${name}</td></tr>
            <tr><td style="padding:6px 0"><strong>Email</strong></td><td>${email}</td></tr>
            <tr><td style="padding:6px 0"><strong>Subject</strong></td><td>${subject}</td></tr>
            <tr><td style="padding:6px 0"><strong>Company</strong></td><td>${company}</td></tr>
            <tr><td style="padding:6px 0"><strong>Source</strong></td><td>${source}</td></tr>
            <tr><td style="padding:6px 0"><strong>Submitted</strong></td><td>${submittedAt}</td></tr>
          </table>
          <p style="margin:0 0 6px 0"><strong>Message</strong></p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;white-space:pre-wrap">${message}</div>
        </div>
      `,
    })

    // Send acknowledgment in background so API responds quickly on slower mobile networks.
    sendEmail({
      from: OTP_FROM_EMAIL,
      to: email,
      subject: `RoadSense: We received your message - ${subject}`,
      text: [
        `Hi ${name},`,
        '',
        'Thanks for contacting RoadSense.',
        'Your request has been received, and our team will get back to you shortly.',
        '',
        `Subject: ${subject}`,
        `Your message: "${message}"`,
        '',
        'Regards,',
        'RoadSense Team',
      ].join('\n'),
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#0f172a;max-width:640px">
          <h2 style="margin:0 0 12px 0;color:#0b3a53">Thanks for contacting RoadSense</h2>
          <p style="margin:0 0 12px 0">Hi ${name},</p>
          <p style="margin:0 0 12px 0">Your request has been received, and our team will get back to you shortly.</p>
          <p style="margin:0 0 6px 0"><strong>Subject</strong>: ${subject}</p>
          <p style="margin:0 0 6px 0"><strong>Your message</strong></p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;white-space:pre-wrap">${message}</div>
          <p style="margin:12px 0 0 0">Regards,<br/>RoadSense Team</p>
        </div>
      `,
    }).catch((mailError) => {
      console.error('Contact auto-reply failed:', mailError)
    })

    return res.json({ ok: true })
  } catch (error) {
    console.error('Contact email send failed:', error)
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to send contact email' })
  }
})

app.post('/otp/verify', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const otp = String(req.body?.otp || '').trim()
    const purpose = normalizePurpose(req.body?.purpose)

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' })
    }

    const { data, error } = await supabase
      .from('email_otp_verifications')
      .select('*')
      .eq('email', email)
      .eq('purpose', purpose)
      .is('verified_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return res.status(500).json({ error: `Supabase lookup failed: ${error.message}` })
    }

    if (!data) {
      return res.status(404).json({ error: 'No active OTP found' })
    }

    if (new Date(data.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'OTP has expired' })
    }

    if (data.otp_hash !== hashOtp(otp)) {
      await supabase
        .from('email_otp_verifications')
        .update({ attempts: Number(data.attempts || 0) + 1 })
        .eq('id', data.id)

      return res.status(400).json({ error: 'Invalid OTP' })
    }

    const { error: verifyError } = await supabase
      .from('email_otp_verifications')
      .update({
        verified_at: new Date().toISOString(),
        attempts: Number(data.attempts || 0) + 1,
      })
      .eq('id', data.id)

    if (verifyError) {
      return res.status(500).json({ error: `Supabase verify failed: ${verifyError.message}` })
    }

    return res.json({ ok: true })
  } catch (error) {
    console.error('OTP verify failed:', error)
    return res.status(500).json({ error: error instanceof Error ? error.message : 'OTP verification failed' })
  }
})

app.use((error, _req, res, _next) => {
  console.error('Unhandled OTP service error:', error)
  res.status(500).json({
    error: error instanceof Error ? error.message : 'Unhandled server error',
  })
})

app.listen(Number(PORT), HOST, () => {
  console.log(`RoadSense OTP service listening on http://${HOST}:${PORT}`)
})
