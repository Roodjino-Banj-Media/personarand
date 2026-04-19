# Deploying `pbroodjino.banjmedia.com`

End state:
- **Vercel** serves the React app + Express API (free tier, no card)
- **Supabase** hosts Postgres DB + file storage + Google OAuth (free tier, no card)
- **GitHub Actions** fires the newsletter scheduler every 15 min (free, no card)
- **Cloudflare DNS** maps `pbroodjino.banjmedia.com` to Vercel (free)

Everything free. No cards anywhere.

---

## 1. Supabase (15 min)

### 1.1 Create project
1. Go to [supabase.com/dashboard/sign-up](https://supabase.com/dashboard/sign-up), sign in with GitHub
2. Click **New project**. Name: `personabrand`. Database password: generate a strong one, save it. Region: closest to you.
3. Wait ~2 min for project provisioning.

### 1.2 Run the schema
1. In Supabase dashboard → **SQL Editor** (left sidebar) → **New query**
2. Open `server/migrations/001_init.sql` in this repo, copy its entire contents
3. Paste into SQL Editor, click **Run**
4. Should see "Success. No rows returned." All tables created.

### 1.3 Create the uploads storage bucket
1. **Storage** → **Create bucket** → Name: `uploads` → Public bucket: **checked** → Create
2. Under the bucket, click **Policies** → the default "authenticated users upload" is fine for our case. The backend uses the service role key which bypasses RLS anyway.

### 1.4 Enable Google OAuth
1. **Authentication → Providers → Google** → toggle **Enable**
2. It asks for a Google OAuth client ID + secret. To get these:
   - Go to [console.cloud.google.com](https://console.cloud.google.com), create a project if needed
   - **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: paste the URL Supabase shows you (looks like `https://PROJECT_REF.supabase.co/auth/v1/callback`)
   - Copy the client ID + client secret back into Supabase
3. Save. Google OAuth is now active.

### 1.5 Get your credentials
Keep these tabs open — you'll paste them into Vercel next:
- **Settings → Database** → Connection String → **Session mode (port 5432)** URI. Copy it (replace `[YOUR-PASSWORD]` with your DB password).
- **Settings → API** → Project URL + `anon public` key + `service_role secret` key.

---

## 2. GitHub (5 min)

1. Create a new repo at [github.com/new](https://github.com/new). Name: `personabrand`. Private.
2. On your machine, in the `PersonaBrand` folder:
   ```bash
   cd "/Users/roodjino/Ongoing Project/Banj FM/PersonaBrand"
   git init
   git add .
   git commit -m "Initial commit — migrated to Supabase + Vercel"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/personabrand.git
   git push -u origin main
   ```

---

## 3. Vercel (10 min)

1. Go to [vercel.com/new](https://vercel.com/new), sign up with GitHub (no card required for hobby tier)
2. Import the `personabrand` repo
3. On the import screen:
   - **Framework preset**: Other
   - **Build command**: `npm run vercel-build` (already set in `vercel.json`)
   - **Output directory**: `client/dist` (already set)
4. Click **Environment variables**, paste ALL of these (get values from Supabase from step 1.5, your Resend dashboard, and your Anthropic console):

   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | `sk-ant-...` from Anthropic console |
   | `RESEND_API_KEY` | `re_...` from Resend |
   | `RESEND_FROM_EMAIL` | e.g. `newsletter@banjmedia.com` |
   | `RESEND_FROM_NAME` | `Roodjino Chérilus` |
   | `DATABASE_URL` | Supabase Session-mode connection string (with password filled in) |
   | `SUPABASE_URL` | `https://PROJECT_REF.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | Service role secret from Supabase |
   | `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` |
   | `VITE_SUPABASE_ANON_KEY` | Anon public key from Supabase |
   | `ALLOWED_EMAILS` | Your Gmail (comma-separated if multiple) |
   | `CRON_SECRET` | A random long string (e.g. run `openssl rand -hex 32`) |
   | `PUBLIC_BASE_URL` | `https://pbroodjino.banjmedia.com` |
   | `NODE_ENV` | `production` |

5. Click **Deploy**. First deploy takes ~2 min.
6. Once deployed, Vercel gives you a temp URL like `personabrand-xxx.vercel.app`. Open it — you should see the Login page.
7. Click **Continue with Google**, sign in with the email you listed in `ALLOWED_EMAILS`. You should land on the Dashboard.

---

## 4. Custom domain (5 min + DNS propagation)

### 4.1 In Vercel
1. Project **Settings → Domains → Add** → type `pbroodjino.banjmedia.com` → Add
2. Vercel shows you a CNAME record to add: `cname.vercel-dns.com`

### 4.2 In your DNS provider (wherever banjmedia.com is hosted — Cloudflare/Namecheap/etc.)
1. Add a new CNAME record:
   - Name/Host: `pbroodjino`
   - Target/Value: `cname.vercel-dns.com`
   - TTL: default
   - **If Cloudflare**: turn the proxy OFF (gray cloud) — Vercel handles TLS
2. Save. DNS propagation takes 1–30 min.

### 4.3 Wait for Vercel to issue TLS
Back in Vercel → Domains, the domain status will flip from "pending" to "valid" once DNS propagates. TLS cert is issued automatically. Open `https://pbroodjino.banjmedia.com` — you're live.

---

## 5. GitHub Actions cron (3 min)

1. In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**
2. Add two secrets:
   | Name | Value |
   |---|---|
   | `CRON_SECRET` | Same value you set in Vercel env (exact same string) |
   | `CRON_URL` | `https://pbroodjino.banjmedia.com/api/cron/run-due-jobs` |
3. **Actions** tab → the cron workflow should show up. It runs every 15 min automatically. You can also hit **Run workflow** manually to test.
4. Verify: after 15 min, check Supabase → **Logs** → **API logs**. You should see a POST to `/api/cron/run-due-jobs` returning 200.

---

## 6. Update Resend "from" domain (optional, for deliverability)

If your `RESEND_FROM_EMAIL` uses a domain not yet verified in Resend:
1. [resend.com/domains](https://resend.com/domains) → Add domain (e.g. `banjmedia.com`)
2. Add the SPF/DKIM/DMARC records to your DNS
3. Verify → `from:` now works at that domain

---

## Migrating existing SQLite data (optional)

The migration swapped SQLite for Postgres. Your current `server/data.db` still exists locally but is no longer used. If you have real data in there you want in production:

```bash
# From the project root
sqlite3 server/data.db .dump > local_dump.sql
```

The dump is SQLite-specific. To import into Supabase, you'd need to translate the INSERT statements manually (datetime formats, boolean values, etc.). For most users this isn't worth it — the seed data repopulates automatically on first DB boot. Only worth doing if you've already accumulated real subscribers / prospects / content.

---

## Local development after this migration

Your local app now ALSO uses Supabase (not SQLite). To dev locally:

1. Create a second Supabase project called `personabrand-dev` (same free tier)
2. Run `server/migrations/001_init.sql` in its SQL Editor
3. Copy `.env.example` to `.env` and fill with dev-project credentials
4. `npm run install:all` then `npm run dev`
5. Open `http://localhost:3000` — same app, local dev DB

Or skip local dev entirely and iterate on Vercel preview deployments (each PR gets a preview URL).

---

## Rollback

If this migration causes issues and you want to go back to local-SQLite:
- `git checkout` the commit before the Supabase migration
- Your local `server/data.db` is untouched by this process

---

## Costs — what "free" actually means

| Service | Free tier limit | Your expected usage | Risk of overage |
|---|---|---|---|
| Supabase | 500MB DB, 1GB storage, 50K MAU | <50MB, <100MB, 1 user | None for years |
| Vercel Hobby | 100GB bandwidth, 100K invocations | Tiny | None |
| GitHub Actions | 2,000 min/mo private repo | ~60 min/mo (cron) | None |
| Anthropic | Pay per token | $10–50/mo depending on use | Billable |
| Resend | 3K emails/mo, 100/day | Up to list size | Upgrade when you outgrow |
| Cloudflare DNS | Unlimited | — | None |

Only actual cost: Anthropic usage + possibly Resend if you grow the list past 3K subscribers.
