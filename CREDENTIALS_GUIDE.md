# Getting Your Supabase Credentials

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in with GitHub
3. Click **"New Project"**
4. Fill in:
   - **Name:** `roadsense`
   - **Database Password:** (generate and save this!)
   - **Region:** Choose closest to you (e.g., `ap-south-1` for India)
5. Click **"Create new project"**
6. Wait 2-3 minutes for setup

## Step 2: Get API Credentials

1. In Supabase Dashboard, go to **Settings** → **API** (left sidebar)
2. You'll see these values:

### Project URL
```
https://xxxxxxxxxxxxx.supabase.co
```
Copy this entire URL

### API Keys

**anon public** (safe to use in mobile app):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHh4eCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjE2MTYxNjE2LCJleHAiOjE5MzE3Mzc2MTZ9.xxxxxxxxxxxxxxxxxxxxxxxxx
```

**service_role** (⚠️ KEEP SECRET - only for server-side):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHh4eCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2MTYxNjE2MTYsImV4cCI6MTkzMTczNzYxNn0.xxxxxxxxxxxxxxxxxxxxxxxxx
```

## Step 3: Configure Mobile App

1. Navigate to `mobile/` directory
2. Copy the example file:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` and paste your credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

## Step 4: Run Database Setup

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Copy contents of `backend/supabase/migrations/001_setup.sql`
4. Paste and click **"Run"**
5. Verify success (no red error messages)

## Step 5: Test Connection

In mobile app, you can test the connection:

```typescript
import { supabase } from './src/services/supabase.service'

// Test query
const { data, error } = await supabase
  .from('anomalies')
  .select('*')
  .limit(1)

console.log('Connection test:', error ? 'Failed' : 'Success')
```

## Security Notes

- ✅ **anon key** is safe to use in mobile app (has RLS restrictions)
- ❌ **service_role key** bypasses RLS - NEVER use in mobile app
- ✅ Always use `.env` files (never commit credentials to Git)
- ✅ `.env` is in `.gitignore` to prevent accidental commits

## Troubleshooting

### "Invalid API key"
- Check you copied the full key (very long string)
- Ensure no extra spaces or line breaks

### "Failed to fetch"
- Check Project URL is correct
- Ensure project is fully provisioned (wait 2-3 minutes)

### "Row Level Security policy violation"
- Run the database setup script (`001_setup.sql`)
- Check RLS policies are created correctly
