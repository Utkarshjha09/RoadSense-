# Google Auth Setup

RoadSense web uses Supabase authentication. Google sign-in is configured through Supabase OAuth, not Firebase.

## Why

The existing app already depends on:

- Supabase sessions
- Supabase row-level security
- the `profiles` table linked to `auth.users`

Using Supabase Google OAuth keeps profile editing and admin permissions working without redesigning the backend auth model.

## Setup steps

1. Open your Supabase project.
2. Go to `Authentication` -> `Providers` -> `Google`.
3. Enable the Google provider.
4. Add your Google OAuth client ID and client secret.
5. In Supabase `Authentication` -> `URL Configuration`, add:

```text
http://localhost:3000
http://localhost:5173
https://your-production-domain.com
```

6. In Google Cloud Console, add the same redirect origins and the Supabase callback URL shown in the provider setup.

## Result

After setup, the web login page supports:

- email/password sign-in
- Google sign-in

Authenticated users can open the profile page and edit their `full_name`.
