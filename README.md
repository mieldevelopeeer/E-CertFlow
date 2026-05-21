# MailBlast — Bulk E-Certificate Email Sender
> Free deployment: Vercel (frontend + API) + Supabase (database + storage)

---

## Stack
| Layer | Service | Cost |
|-------|---------|------|
| Frontend | Vercel Static | Free |
| API (SMTP relay) | Vercel Serverless Functions | Free |
| Database | Supabase Postgres | Free |
| File Storage | Supabase Storage | Free (1 GB) |
| Email sending | Gmail SMTP (via App Password) | Free (500/day) |

---

## Quickstart

### 1. Supabase Setup
1. Create a free project at https://supabase.com
2. Go to **SQL Editor** → paste and run `supabase-schema.sql`
3. Go to **Storage** → create a bucket named `attachments` → set to **Public**
4. Copy your **Project URL** and **anon key** from Settings > API

### 2. Gmail App Password
1. Enable 2FA on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Create an app password for "Mail" → copy the 16-char code
4. Use this as the `app_password` in the Credentials page (NOT your Gmail password)

### 3. Deploy to Vercel
```bash
# Option A: via CLI
npm install -g vercel
cd mailblast
vercel

# Option B: via GitHub
# Push this folder to a GitHub repo
# Go to vercel.com > New Project > Import repo
```

### 4. Set Environment Variables in Vercel
In your Vercel project dashboard → **Settings → Environment Variables**:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | your service role key |

> The frontend uses the Supabase CDN SDK with the anon key — update the two
> constants at the top of `app.js` with your actual values before deploying.

### 5. Local Development
```bash
npm install
npx vercel dev   # runs both static files and API routes locally
```

---

## Project Structure
```
mailblast/
├── index.html          # Main SPA
├── style.css           # All styles
├── app.js              # Frontend logic + Supabase client
├── api/
│   └── send-email.js   # Vercel serverless function (Nodemailer)
├── supabase-schema.sql # Run once in Supabase SQL editor
├── vercel.json         # Vercel routing config
├── package.json
└── .env.example
```

---

## Features
- ✅ Save multiple SMTP credentials (Gmail, Outlook, custom)
- ✅ Compose with merge fields: `{{name}}`, `{{email}}`, `{{custom}}`
- ✅ Upload attachments (PDF certs, images) → stored in Supabase
- ✅ Import recipients from CSV
- ✅ Real-time send progress bar
- ✅ Campaign history with sent/failed counts
- ✅ Per-email delivery logs

## CSV Format
```
name,email,custom
Juan dela Cruz,juan@example.com,Certificate #001
Maria Santos,maria@example.com,Certificate #002
```

---

## Limits (Free Tier)
| Limit | Value |
|-------|-------|
| Gmail sends/day | 500 (personal) / 2,000 (Workspace) |
| Supabase DB rows | Unlimited |
| Supabase Storage | 1 GB |
| Vercel function invocations | 100,000 / month |
| Vercel function duration | 10 seconds max per email |
