# ParcelOS — Supabase Auth Setup

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. Copy **Project URL** and **anon public key** from Settings → API.
3. Copy `.env.example` to `.env.local`:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_APP_URL=http://localhost:3000
VITE_PLATFORM_OWNER_EMAIL=admin@mthunzi.tech
```

## 2. Apply database migrations

```bash
npm install -g supabase
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Or locally:

```bash
supabase start
supabase db reset
```

## 3. Create your first users

### Platform owner (MTHUNZI-TECH-LABS)

1. Supabase Dashboard → **Authentication** → **Users** → **Add user**
2. Email: `admin@mthunzi.tech`, set a password
3. SQL Editor:

```sql
SELECT public.bootstrap_platform_admin('admin@mthunzi.tech');
```

Sign in at `/login` → redirects to `/admin`.

### Company admin (Swift Logistics demo)

1. Create user: `linda@swiftlogistics.zm`
2. SQL Editor:

```sql
SELECT public.bootstrap_company_admin('linda@swiftlogistics.zm');
```

Sign in at `/login` → redirects to `/app`.

## 4. Demo mode (no Supabase)

If env vars are **not** set, the app runs in **demo mode**:
- Role picker on login (no password)
- Mock data for parcels and companies
- All UI remains functional for prototyping

## 5. Password reset

Configured automatically via Supabase Auth. Users click **Forgot password?** on `/login`.

Redirect URL must include your app URL in Supabase → Authentication → URL Configuration.

## 6. Instant signup (no email confirmation)

Company signup at `/signup` creates a **confirmed** Auth user immediately (via `signup-courier` edge function), signs them in, and provisions the company. No “confirm your email” click.

### Required: turn off Confirm email in Supabase (hosted)

1. Supabase Dashboard → **Authentication** → **Providers** → **Email**
2. Turn **Confirm email** **OFF**
3. Save

This stops broken/missing confirm emails and matches the instant-onboarding product flow.

### Deploy signup function

```bash
supabase functions deploy signup-courier
```

### Optional congratulations email

Set Edge Function secrets:

```bash
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set RESEND_FROM_EMAIL="ParcelOS <hello@your-domain.com>"
supabase secrets set APP_URL=https://your-app.netlify.app
```

Without Resend, signup still works — only the welcome email is skipped.

### Auth URL config (password reset / magic links)

1. **Authentication** → **URL Configuration**
2. **Site URL** = your live app URL
3. **Redirect URLs** include your live domain and `http://localhost:8080/**` for local dev

## 7. Row Level Security

All data queries use the user's JWT. Platform owners bypass tenant isolation via `is_platform_owner()`. Company staff only see their `company_id` data.

Never expose `SUPABASE_SERVICE_ROLE_KEY` in the browser.
