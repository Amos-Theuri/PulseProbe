# PulseProbe: $0 / 100% Free Hosting Architecture Guide

This comprehensive guide outlines how to host and operate **PulseProbe** continuously in production with **$0 financial costs** using free tier cloud primitives.

---

## 1. Architecture Summary

| Component | Free Provider | Free Tier Limits | Purpose in PulseProbe |
| :--- | :--- | :--- | :--- |
| **App & API Hosting** | **Vercel** (Hobby) | 100GB Bandwidth, unlimited serverless invocations | Hosts Next.js App Router, SSR, Route Handlers, SSE stream |
| **PostgreSQL Database** | **Neon** (Free Tier) | 0.5 GiB storage, scale-to-zero compute | Relational persistence for Monitors, PingLogs, Incidents |
| **Automated Ping Cron** | **cron-job.org** or **GitHub Actions** | 100% Free (unlimited HTTP webhooks) | Ticks `/api/worker/tick` to run background probe checks 24/7 |
| **Domain & SSL** | **Vercel Subdomain** (`.vercel.app`) | Free wildcard SSL included | Zero-cost SSL certificate and public HTTPS URL |

---

## 2. Step 1: Database Setup (Neon Free Tier)

1. Sign up for free at [neon.tech](https://neon.tech).
2. Create a free project named `pulseprobe`.
3. In the Neon Console Dashboard, obtain your **pooled connection string** (contains `-pooler`):
   ```text
   DATABASE_URL="postgresql://<user>:<password>@<endpoint>-pooler.<region>.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
   ```
4. Also copy the **direct unpooled connection string** (without `-pooler`) used for applying schema migrations:
   ```text
   DATABASE_URL_UNPOOLED="postgresql://<user>:<password>@<endpoint>.<region>.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
   ```
5. Apply database migrations to create the initial tables:
   ```bash
   # From your local terminal with DATABASE_URL set in .env
   npx prisma migrate deploy
   ```

---

## 3. Step 2: Deploy Next.js to Vercel (Hobby Tier — $0)

Vercel provides native hosting for Next.js applications with global edge distribution, automated SSL, and zero configuration for App Router.

### A. Pre-Deployment Preparation
1. Ensure your repository is committed and pushed to GitHub:
   ```bash
   git status
   git push origin main
   ```
2. Verify that `package.json` contains the updated build script:
   ```json
   "build": "prisma generate && next build"
   ```
   *(This ensures Vercel automatically generates the Prisma Client during every build before bundling the application).*

---

### B. Project Import on Vercel
1. Log in to [vercel.com](https://vercel.com) using your GitHub account.
2. From the Vercel Dashboard, click **"Add New..."** → **"Project"**.
3. Under **"Import Git Repository"**, locate your `PulseProbe` repository and click **"Import"**.
4. Configure Project Settings:
   - **Framework Preset**: `Next.js` (detected automatically).
   - **Root Directory**: `./` (leave default).
   - **Build & Development Settings**: Keep defaults (`npm run build`, output `.next`).

---

### C. Environment Variables Configuration

Before clicking Deploy, expand the **"Environment Variables"** section and add the following keys:

| Environment Variable | Recommended Value | Description & Importance |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://...-pooler...` | **Pooled Neon connection string**. Essential on Vercel serverless to prevent connection exhaustion. |
| `DATABASE_URL_UNPOOLED` | `postgresql://...` (direct) | Unpooled connection string used for schema migrations. |
| `NEXT_PUBLIC_APP_URL` | `https://your-project.vercel.app` | Base public URL of your deployment (used for links and CORS). |
| `PULSEPROBE_API_KEY` | Strong random string (e.g. `pwgen 32`) | **Admin Authentication Key**. Protects mutating endpoints (`/api/monitors`, `/api/worker/tick`). |
| `MONITOR_WORKER_CONCURRENCY` | `5` | Maximum targets checked concurrently per worker tick. |
| `PROBE_DEFAULT_TIMEOUT_MS` | `5000` | Default probe network timeout (5 seconds). |
| `INCIDENT_FAIL_THRESHOLD` | `3` | Consecutive failed checks before opening an outage incident. |
| `MAX_MONITORS` | `50` | Maximum number of monitors allowed in database. |
| `MAX_SSE_CLIENTS` | `100` | Maximum concurrent streaming connections per container. |

> [!IMPORTANT]
> **Why Connection Pooling Matters on Vercel**:
> Vercel executes Next.js route handlers inside serverless functions. Each function instance spins up and tears down independently. Without Neon's `-pooler` endpoint, multiple concurrent requests could open dozens of direct Postgres connections, quickly exceeding the free database connection limit. Neon's connection pooler multiplexes thousands of serverless requests through a persistent connection pool.

---

### D. Triggering Deployment
1. Click **"Deploy"**.
2. Vercel will clone the repo, run `npm install`, execute `prisma generate && next build`, and deploy your edge functions.
3. Upon completion, Vercel provides a public deployment URL (e.g. `https://pulseprobe-abc.vercel.app`).

---

### E. Vercel Serverless Behavior & Mechanics in PulseProbe

Understanding how PulseProbe operates within Vercel's serverless architecture:

1. **Function Execution Duration**:
   - Vercel Hobby tier allows a maximum execution duration of **15 seconds** per request.
   - PulseProbe enforces `PROBE_DEFAULT_TIMEOUT_MS=5000` (5s) and processes targets with a concurrency pool of 5 workers.
   - When a tick is triggered, 10–20 monitors finish probing in under 5–8 seconds, well below Vercel's timeout.

2. **Real-time Server-Sent Events (SSE)**:
   - The status stream at `/api/events` uses HTTP streaming via the Web Streams API.
   - PulseProbe emits a `: heartbeat\n\n` event every 15 seconds to keep the connection alive through intermediate proxies.
   - If Vercel terminates the streaming connection after an idle period, PulseProbe's frontend automatically reconnects and includes a 20-second polling fallback so live data is never lost.

3. **HTTP Security Headers**:
   - Production builds automatically inject OWASP security headers defined in `next.config.ts`:
     - `X-Frame-Options: DENY` (clickjacking defense)
     - `X-Content-Type-Options: nosniff` (MIME sniffing defense)
     - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (enforces HTTPS)
     - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

### F. Optional: Custom Domain & Free SSL
If you own a custom domain (e.g., `status.yourdomain.com`):
1. In Vercel, navigate to **Project Settings** → **Domains**.
2. Enter your domain (e.g. `status.yourdomain.com`).
3. Add the `CNAME` record in your DNS provider pointing to `cname.vercel-dns.com`.
4. Vercel will automatically provision a free Let's Encrypt SSL certificate and auto-renew it.

---

## 4. Step 3: Configure 24/7 Background Probing ($0 Cron Trigger)

Next.js serverless functions sleep when no requests are being served. To continuously probe your endpoints without leaving your browser open, set up an external automated cron trigger.

### Option A: Free External Webhook Cron via cron-job.org (Recommended)
This option allows high-frequency probing (every 1 to 2 minutes) for 100% free:

1. Sign up for a free account at [cron-job.org](https://cron-job.org).
2. Click **"Create Cronjob"**:
   - **Title**: `PulseProbe Background Worker`
   - **URL**: `https://your-project.vercel.app/api/worker/tick`
   - **Schedule**: Every `1 minute` (or every `2 minutes`)
   - **Request Method**: `POST`
3. Under **Advanced Settings** → **HTTP Headers**, add:
   ```text
   Authorization: Bearer <YOUR_PULSEPROBE_API_KEY>
   ```
   *(Or add header `x-api-key: <YOUR_PULSEPROBE_API_KEY>`)*.
4. Save the job.
5. Your targets will now be actively monitored 24/7 across the globe without maintaining any persistent server!

---

### Option B: Free GitHub Actions Scheduled Workflow
If you prefer managing the cron inside your GitHub repository:

Create `.github/workflows/pulseprobe-cron.yml`:
```yaml
name: PulseProbe Background Cron

on:
  schedule:
    - cron: '*/5 * * * *' # Every 5 minutes (GitHub Actions minimum schedule)
  workflow_dispatch:

jobs:
  tick:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Probe Worker Tick
        run: |
          curl -X POST -f \
            -H "Authorization: Bearer ${{ secrets.PULSEPROBE_API_KEY }}" \
            https://your-project.vercel.app/api/worker/tick
```
Add `PULSEPROBE_API_KEY` to your repository secrets (**Settings** → **Secrets and variables** → **Actions**).

---

## 5. Post-Deployment Verification Checklist

Once deployed to Vercel, verify your live system:

- [ ] **Open Status Page**: Visit `https://your-project.vercel.app`. The dashboard should render with operational indicators and empty/default monitors.
- [ ] **Admin Authentication**: Click the **"Admin Unlock"** button in the header. Enter your `PULSEPROBE_API_KEY`. The button changes to a green **"Admin Mode"** indicator.
- [ ] **Add a Target**: Click **"Add Target"** and add a verifiable endpoint (e.g. `https://1.1.1.1/cdn-cgi/trace` with 60s interval).
- [ ] **Run Manual Probe**: Click **"Probe Cycle"** in the navbar to trigger an immediate check. Verify that the latency sparkline and uptime bar update in real time.
- [ ] **Verify Worker Cron**: Check cron-job.org execution history to ensure `POST /api/worker/tick` returns HTTP 200 responses.
- [ ] **Check Neon Telemetry**: Log in to Neon Console and verify that rows are being written to `PingLog`.
