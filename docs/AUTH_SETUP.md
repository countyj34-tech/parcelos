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

## 6. Email confirmation (“site can’t be reached” on confirm link)

When a company signs up at `/signup`, Supabase sends a confirm email. The link verifies the user, then **redirects to your app** (usually `/login`). If that redirect URL is wrong, the phone/browser shows **site can’t be reached**.

### Fix (Supabase Dashboard)

1. Open **Authentication** → **URL Configuration**
2. Set **Site URL** to your **live** app URL (not localhost), e.g.  
   `https://your-app.netlify.app` or your Lovable publish URL
3. Under **Redirect URLs**, add (replace with your real domain):
   ```
   https://your-app.netlify.app/**
   https://your-app.netlify.app/login
   http://localhost:3000/**
   http://localhost:3000/login
   ```
4. Save

### Fix (deploy env)

In Netlify / Lovable environment variables, set:

```env
VITE_APP_URL=https://your-app.netlify.app
```

Redeploy after changing env vars.

### Why it happens

- Supabase **Site URL** was left at `http://127.0.0.1:3000` or `http://localhost:3000`
- Your live domain is **not** in **Redirect URLs**, so Supabase falls back to Site URL
- You open the email on your **phone**, which cannot reach `localhost` on your laptop

After fixing, **sign up again** (or resend confirmation from Supabase → Authentication → Users) and tap the new link.

## 7. Row Level Security

All data queries use the user's JWT. Platform owners bypass tenant isolation via `is_platform_owner()`. Company staff only see their `company_id` data.

Never expose `SUPABASE_SERVICE_ROLE_KEY` in the browser.
