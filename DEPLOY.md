# Kingshot Hub — Deployment Guide

This guide walks a non-technical user through deploying Kingshot Hub from scratch. Estimated time: 45–60 minutes.

---

## What You'll Need
- A computer with a web browser
- An email address
- A phone (optional, for testing)
- A credit card (free tiers on all services — card may be required for verification only)

---

## Step 1: Create a Supabase Project (Database + Auth)

**Supabase hosts your database, handles user logins, and stores files.**

1. Go to [https://supabase.com](https://supabase.com) and click **Start your project**
2. Sign up with GitHub or Google
3. Click **New project**
4. Fill in:
   - **Organization**: Create one with your alliance name
   - **Name**: `kingshot-hub` (or whatever you like)
   - **Database Password**: Create a strong password — **write it down somewhere safe**
   - **Region**: Choose the one closest to your players
5. Click **Create new project** — wait 2–3 minutes for it to set up

### Run the Database Schema

1. In Supabase, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `supabase/schema.sql` from this project folder
4. Copy the entire contents and paste into the SQL editor
5. Click **Run** (or press Ctrl+Enter)
6. You should see "Success. No rows returned" — this means the schema ran correctly

### Get Your API Keys

1. In Supabase, go to **Settings → API** (gear icon in sidebar)
2. Copy these values (you'll need them later):
   - **Project URL** → this is `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** key → this is `SUPABASE_SERVICE_ROLE_KEY` (⚠️ keep this secret!)

### Set Up Authentication Providers

1. In Supabase, go to **Authentication → Providers**
2. **Email**: Enable it, turn on **"Enable Email Confirmations"** OFF (use magic links without confirmation)
3. **Google OAuth** (optional):
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a project → Enable "OAuth 2.0" → Create credentials
   - Add callback URL: `https://YOUR-PROJECT-ID.supabase.co/auth/v1/callback`
   - Paste Client ID and Secret into Supabase
4. **Discord OAuth** (optional):
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - New Application → OAuth2 → Add redirect: `https://YOUR-PROJECT-ID.supabase.co/auth/v1/callback`
   - Paste Client ID and Secret into Supabase

---

## Step 2: Get an Anthropic API Key (AI Battle Planning)

**The AI battle planner uses Claude to generate optimized assignments.**

1. Go to [https://console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Go to **API Keys** → click **Create Key**
4. Copy the key — you'll only see it once! This is `ANTHROPIC_API_KEY`
5. Add payment method (pay-per-use, very cheap — a typical plan generation costs ~$0.01)

---

## Step 3: (Optional) Google Vision API for OCR

**Skip this if you want members to enter stats manually.**

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project or select existing
3. Go to **APIs & Services → Library**
4. Search "Cloud Vision API" and **Enable** it
5. Go to **Credentials → Create Credentials → API Key**
6. Copy the key — this is `GOOGLE_VISION_API_KEY`

---

## Step 4: (Optional) Resend for Email Notifications

1. Go to [https://resend.com](https://resend.com) and sign up
2. Go to **API Keys → Create API Key**
3. Copy the key — this is `RESEND_API_KEY`
4. Add and verify your sending domain (or use the free sandbox for testing)

---

## Step 5: Deploy to Vercel

**Vercel hosts your web app for free.**

### Push to GitHub First

1. Go to [https://github.com](https://github.com) and create an account if you don't have one
2. Create a **new repository** (name it `kingshot-hub`, set to Private)
3. Install [GitHub Desktop](https://desktop.github.com/) on your computer
4. Open GitHub Desktop → **Add Existing Repository** → select the `kingshot` folder
5. Commit all files with message "Initial commit"
6. Click **Publish repository** to GitHub

### Deploy on Vercel

1. Go to [https://vercel.com](https://vercel.com) and sign up with GitHub
2. Click **New Project**
3. Find your `kingshot-hub` repository and click **Import**
4. Under **Framework Preset**, Vercel should auto-detect **Next.js** ✓
5. **DO NOT click Deploy yet** — you need to set environment variables first

### Set Environment Variables

In the Vercel project setup, find **Environment Variables** and add each of these:

| Variable Name | Value | Where to find it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key | Supabase → Settings → API |
| `ANTHROPIC_API_KEY` | Your Anthropic key | Anthropic Console → API Keys |
| `GOOGLE_VISION_API_KEY` | Google Vision key | Google Cloud Console (optional) |
| `GOOGLE_TRANSLATE_API_KEY` | Google Translate key | Google Cloud Console (optional) |
| `RESEND_API_KEY` | Resend key | Resend dashboard (optional) |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL | You'll get this after first deploy — come back and add it |

6. Click **Deploy**
7. Wait 2–3 minutes for the build to complete
8. Vercel will give you a URL like `kingshot-hub-xxx.vercel.app`
9. Go back to Environment Variables and set `NEXT_PUBLIC_APP_URL` to that URL

### Update Supabase Auth Redirect URLs

1. In Supabase, go to **Authentication → URL Configuration**
2. Set **Site URL** to your Vercel URL (e.g., `https://kingshot-hub-xxx.vercel.app`)
3. Under **Redirect URLs**, add: `https://kingshot-hub-xxx.vercel.app/auth/callback`
4. Click Save

---

## Step 6: Create the First Admin Account

1. Go to your deployed app URL
2. Enter your email and click **Send magic link**
3. Check your email and click the magic link
4. You'll be redirected to the app, but won't have a role yet

### Assign Admin Role via Supabase

1. In Supabase, go to **SQL Editor**
2. Run this query (replace `your@email.com` with your email):

```sql
UPDATE user_profiles 
SET role = 'system_admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'your@email.com'
);
```

3. Refresh the app — you should now see the Admin section in the sidebar

---

## Step 7: Initial Setup

Once logged in as admin:

1. **Create a Kingdom**: Go to Admin → Kingdoms → Add Kingdom
   - Enter your kingdom/server name and number

2. **Create Your Alliance**: Go to `/alliances/new`
   - Enter alliance name, tag (e.g., "ABC"), select your kingdom

3. **Add Members**: Go to your alliance → Members → Add Member
   - Add each player by name
   - Click the copy icon to get their personal link (send to them in-game)

4. **Send Member Links**: Each member gets a unique URL like:
   `https://your-app.vercel.app/member/UNIQUE-TOKEN`
   They can use this link without creating an account to:
   - Update their power, troops, march size
   - Add their heroes
   - Submit availability for events

5. **Create Your First Event**: Go to Events → New Event
   - Select event type (Swordland, KVK Castle Battle, or Tri Alliance Clash)
   - Set the battle time

---

## Step 8: Set Member Roles

To give other officers R4/R5 access:

1. They must first log in with their email (get a magic link)
2. In Supabase SQL Editor, run:

```sql
UPDATE user_profiles 
SET role = 'r5', alliance_id = 'YOUR-ALLIANCE-UUID'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'officer@email.com'
);
```

Replace `YOUR-ALLIANCE-UUID` with the ID from your alliance URL.

---

## Troubleshooting

**"Unauthorized" errors**: Make sure you ran the full schema SQL, including the RLS policies at the bottom.

**Login not working**: Check that your Supabase Site URL and Redirect URL are set correctly.

**Battle plan not generating**: Verify your `ANTHROPIC_API_KEY` is set correctly in Vercel. The key should start with `sk-ant-`.

**Members can't access their portal**: The member link uses their `access_token` UUID. If they say the link doesn't work, go to Members in the app and copy their link again.

**Database changes needed**: Make changes in Supabase SQL Editor directly. Never modify the schema file and re-run it — use ALTER TABLE statements instead.

---

## Keeping the App Updated

When a new version of Kingshot Hub is released:

1. Download the updated files
2. Copy them into your project folder (overwriting old files)
3. Commit and push to GitHub using GitHub Desktop
4. Vercel will automatically rebuild and deploy

No database changes are needed for most updates. If there are schema changes, they'll be noted in the release notes with the SQL to run.

---

## Support

For help with the app, post in your alliance Discord or contact your R5. The app is designed to work without technical knowledge once deployed.
