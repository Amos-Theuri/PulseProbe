# PulseProbe: Distributed API Uptime & Latency Beacon

A production-grade, self-hostable service monitoring and status beacon designed to track real public and private HTTP/HTTPS endpoints, log live latency with monotonic precision, detect downtime, escalate incidents after consecutive failures, and stream real-time updates via Server-Sent Events (SSE).

---

## 1. Tech Stack & Architecture

- **Framework**: Next.js 16 (App Router, React 19, TypeScript, Tailwind CSS)
- **API Engine**: Next.js Route Handlers with Web Request & Response APIs
- **Database & ORM**: PostgreSQL with Prisma ORM
- **Network Probe**: Native fetch with monotonic clock (`performance.now()`), AbortController timeouts, and strict SSRF protection
- **Real-time Engine**: Server-Sent Events (SSE) via Web Streams API (`/api/events`)
- **Testing**: Vitest test suite for SSRF enforcement, probe error classification, and sliding-window uptime calculation

---

## 2. Setting Up Resources & Database

PulseProbe uses PostgreSQL for persisting targets (`Monitor`), ping telemetry (`PingLog`), and outage records (`Incident`). Choose one of the setup methods below:

### Option A: Free Cloud PostgreSQL (Recommended — Neon or Supabase)
1. Sign up for free at [neon.tech](https://neon.tech) or [supabase.com](https://supabase.com).
2. Create a database project and copy your connection string (e.g. `postgresql://user:password@ep-sample.aws.neon.tech/pulseprobe?sslmode=require`).
3. Paste it into `.env`:
   ```bash
   DATABASE_URL="postgresql://user:password@ep-sample.aws.neon.tech/pulseprobe?sslmode=require"
   ```

### Option B: Local Docker Container
If Docker is installed:
```bash
docker run --name pulseprobe-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pulseprobe -p 5432:5432 -d postgres:16
```
Then configure in `.env`:
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pulseprobe?schema=public"
```

### Option C: Native Linux PostgreSQL
```bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE DATABASE pulseprobe;"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
```

---

## 3. Database Migration

Once your `DATABASE_URL` is set:
```bash
# Generate the Prisma Client
npm run prisma:generate

# Run schema migrations
npm run prisma:migrate
```

*Note: PulseProbe also includes an automatic in-memory fallback layer, allowing you to run, explore the UI, and probe endpoints even before completing database configuration.*

---

## 4. Running the Application

### Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Automated Test Suite
Run the test suite verifying SSRF protection, uptime aggregation, and probe error classification:
```bash
npm test
```

### Production Build
```bash
npm run build
npm start
```

---

## 5. Security & SSRF Protection

PulseProbe enforces strict SSRF protections in `src/lib/probe/ssrf.ts` and `src/lib/probe/engine.ts`:
- **Protocol Whitelisting**: Rejects non-HTTP/HTTPS protocols (e.g. `file://`, `ftp://`, `gopher://`).
- **Private Subnet Blocking**: Blocks private IPv4 subnets (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
- **Cloud Metadata & Link-Local Protection**: Blocks link-local and cloud metadata ranges (`169.254.169.254`, `fe80::/10`).
- **IPv6 Loopback & ULA**: Blocks IPv6 loopback (`::1`) and unique local addresses (`fc00::/7`).
- **Safe HTTP Redirects**: Follows redirects with `redirect: "manual"`, re-validating the destination against SSRF rules before each hop.
- **DNS Rebinding Defense**: Intercepts socket connection to verify destination IP addresses at connect time.
- **Rate Limiting**: In-memory sliding window rate limits protect public status checks and mutating endpoints.

### Production Deployment Security Checklist

When deploying PulseProbe publicly (e.g. on Vercel or a custom server):
1. **Configure `PULSEPROBE_API_KEY`**: Set a strong random secret token in your production environment variables. Mutating routes (`POST/PATCH/DELETE /api/monitors` and `POST /api/worker/tick`) will require `Authorization: Bearer <token>`.
2. **Security Headers**: Production builds automatically serve hardened HTTP security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Permissions-Policy`).

---

## 6. Community & Compliance

- **License**: [MIT License](LICENSE)
- **Security Policy**: [SECURITY.md](SECURITY.md) — Responsible vulnerability disclosure instructions.
- **Contributing**: [CONTRIBUTING.md](CONTRIBUTING.md) — Local setup, testing, and pull request guidelines.
- **Code of Conduct**: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

