# OTP Service

This service sends and verifies email OTPs using Nodemailer.

It is used for:

- email/password login verification
- password change verification

Supabase still handles:

- primary authentication
- Google OAuth
- password storage and password updates

## Setup

1. Copy `.env.example` to `.env`
2. Fill in:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - SMTP credentials
3. Install dependencies:

```bash
npm install
```

4. Run the service:

```bash
npm run dev
```

Default URL:

```text
http://localhost:4001
```

## Required database change

Run the Supabase migration that creates `public.email_otp_verifications`.
