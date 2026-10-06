# PulseProbe: Distributed API Uptime & Latency Beacon

A production-grade, self-hostable service monitoring and status beacon designed to track real public and private HTTP/gRPC endpoints, log live regional latency, detect downtime, and display real-time incident updates via WebSockets.

## 1. Project Overview & Scope

Unlike placeholder dashboards that generate artificial traffic, **PulseProbe** acts on real user-provided targets:

* Users register verifiable API endpoints, webhook URLs, or domain names.

* A scheduled worker engine performs actual periodic HTTP/DNS/SSL handshakes.

* True response status codes, TTFB (time to first byte), SSL certificate expiry, and failure errors are recorded into a persistent store.

* Real-time subscriber alerts fire upon verifiable consecutive failures.

* A public status dashboard renders real historical uptime calculations.

## 2. Core Architecture & Tech Stack

The agent must build this system according to the following architecture:

| Tier | Technology | Purpose | 
| ----- | ----- | ----- | 
| **Frontend** | Next.js (App Router, React 19, TypeScript, Tailwind CSS) | Responsive SSR/SSG status beacon + private management portal | 
| **Backend API** | Node.js / Hono or Next.js Route Handlers with Edge Runtime | Lightweight, high-throughput health check ingest and REST endpoints | 
| **Database** | PostgreSQL (via Prisma ORM or Drizzle ORM) | Relational persistence for targets, ping logs, incidents, and audit trails | 
| **Worker / Probe** | Background scheduler (Node-Cron, BullMQ, or standalone worker loop) | Executes authentic network requests without blocking the web process | 
| **Realtime** | Server-Sent Events (SSE) or WebSockets | Streams active ping updates and incident alerts directly to connected browsers | 
| **Validation** | Zod | End-to-end schema validation across runtime and API layers | 

## 3. Data Schema & Models

The relational database must implement at least the following entity relations:

```
+-------------------+       1:N       +-------------------+
|      Monitor      | --------------< |      PingLog      |
+-------------------+                 +-------------------+
| id (UUID)         |                 | id (BigInt)       |
| name (String)     |                 | monitorId (UUID)  |
| url (String)      |                 | statusCode (Int)  |
| intervalSeconds   |                 | responseTimeMs    |
| expectedStatus    |                 | timestamp (UTC)   |
| active (Boolean)  |                 | isHealthy (Bool)  |
| lastCheckAt       |                 | errorMessage      |
+-------------------+                 +-------------------+
          |
          | 1:N
          v
+-------------------+
|     Incident      |
+-------------------+
| id (UUID)         |
| monitorId (UUID)  |
| status (OPEN/ACK) |
| startedAt (UTC)   |
| resolvedAt (UTC)  |
| reason (String)   |
+-------------------+

```

## 4. Instructions for the Antigravity (`agy`) Agent

When running `agy` to generate and maintain this codebase, adhere strictly to the following execution guidelines:

### A. Phase 1: Environment & Scaffolding

1. Initialize a clean TypeScript workspace with `strict: true` and ESLint configuration.

2. Scaffold an organized folder hierarchy:

   ```
   ├── src/
   │   ├── app/                # Next.js App Router (Pages, Layouts, API Routes)
   │   ├── components/         # Atomic UI components (Shadcn/Tailwind)
   │   │   ├── dashboard/      # Status cards, latency sparklines, incident feed
   │   │   └── ui/             # Reusable accessible primitives
   │   ├── lib/
   │   │   ├── db/             # Prisma client & database schemas
   │   │   ├── probe/          # Network checker (Fetch, TLS verification, DNS)
   │   │   └── scheduler/      # Cron-based worker dispatcher
   │   └── types/              # Unified TypeScript interfaces and Zod schemas
   ├── tests/                  # Integration and unit tests
   └── README.md
   
   ```

3. Set up environment variable contracts in `.env.example`:

   * `DATABASE_URL`

   * `NEXT_PUBLIC_APP_URL`

   * `MONITOR_WORKER_CONCURRENCY`

### B. Phase 2: Probe Engine Implementation

* **Authentic Fetch Execution:** Never mock network responses in production services. The ping engine must use the native `fetch` or `undici` library with explicit timeout configurations (default: 5000ms).

* **Measurement Precision:** Capture response duration using high-resolution monotonic clocks (`performance.now()`).

* **Resilience:** Handle unreachable hosts, DNS resolution failures (`ENOTFOUND`), and SSL validation errors with structured error categories.

* **Incident Escalation:** Trigger an Incident record only after $N$ consecutive check failures (e.g., 3 failed checks), preventing false positives from transient blips.

### C. Phase 3: Status UI & Public Beacon

* Compute real uptime percentages for the last 24h, 7d, and 30d using SQL aggregations:
  

  $$
  \text{Uptime \%} = \left( \frac{\text{Successful Pings}}{\text{Total Pings}} \right) \times 100
  $$

* Implement clean, accessible SVG sparklines depicting actual latency curves for each active monitor.

* Provide a clear public incident history log showing exact start times, resolution timestamps, and root causes.

## 5. Industry Standards & Quality Requirements

The agent must guarantee adherence to the following production standards:

1. **Security & Input Sanitization:**

   * **SSRF Protection:** Ensure the probe engine explicitly forbids internal/private IP ranges (e.g., `127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`, AWS metadata `169.254.169.254`).

   * Validate and normalize every submitted URL strictly using Zod (`z.string().url()`).

2. **Defensive Database Queries:**

   * Add database indexes to `(monitorId, timestamp)` in the `PingLog` table to prevent table scans on high-frequency aggregation queries.

   * Implement retention policies or partitioning for logs older than 90 days.

3. **Type Safety & Zero Warnings:**

   * Strict TypeScript; ban `any`. All API responses must return structured JSON conforming to shared contracts.

4. **Automated Verification:**

   * Supply unit tests using Vitest/Jest for the probe engine and uptime calculation functions.

   * Include integration tests mocking real HTTP endpoints with `msw` or an ephemeral HTTP server to assert worker correctness.

## 6. Getting Started

### Local Setup

```
# 1. Clone & install dependencies
git clone <repo-url>
cd pulseprobe
npm install

# 2. Configure Environment
cp .env.example .env.local

# 3. Database Migration
npx prisma migrate dev --name init

# 4. Start local development server & probe worker
npm run dev

```

### Running with Antigravity (`agy`)

To instruct the agent to execute this plan milestone by milestone:

```
agy "Read README.md, initialize the schema in Prisma, and implement the SSRF-safe probe engine in src/lib/probe/"

```