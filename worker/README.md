# WordPress Finder — Verified Domain Collector

A production-grade **Node.js + TypeScript** worker that streams Common Crawl WARC
files, detects WordPress sites, then **verifies each domain live** (DNS + HTTP +
WordPress probes) before inserting into PostgreSQL.

Collects **500 verified domains** by default, streaming through as many WARC
segments as needed. Fully configurable concurrency, timeouts, and retry logic.

---

## How It Works

```
Common Crawl WARC Index (warc.paths.gz)
         │
         ▼  ← iterates WARC segments one at a time
HTTPS stream (WARC .gz)
         │
         ▼
   zlib gunzip (in-process)
         │
         ▼
   WARC record parser
     (filter: WARC-Type=response, HTTP 200, text/html)
         │
         ▼
   WordPress pre-filter (detector.ts)
     (body scan for /wp-content/, /wp-login.php, /wp-admin/, /wp-includes/)
         │
         ▼
   Bounded Queue (cap=100, backpressure)
         │
    ┌────┴────┐────┐─── ... ───┐
    ▼         ▼    ▼            ▼
 Worker 1  Worker 2  ...    Worker N  (default N=20)
    │         │    │            │
    ▼         ▼    ▼            ▼
 3-Stage Verification:
   1. DNS resolve
   2. HTTP probe (accept 200/301/302)
   3. WordPress check:
      - meta generator tag
      - /wp-json/
      - /wp-login.php
      - /wp-content/
    │
    ▼
 PostgreSQL (via Prisma, duplicate-safe)
    │
    ▼  ← stops at 500 verified+inserted
 Done ✅
```

### Why stream?

WARC files are 700 MB–1 GB each. Streaming means:
- We start finding URLs **within seconds**.
- We **stop the download** the moment we reach the target.
- **No disk space** is wasted storing the full WARC.
- **Constant memory** via bounded queue backpressure.

---

## Folder Structure

```
worker/
├── src/
│   ├── index.ts        Entry point — boots the runner
│   ├── runner.ts       Orchestration — producer/consumer pipeline
│   ├── warcParser.ts   Streams & parses WARC records
│   ├── warcIndex.ts    Iterates WARC file URLs from CC index
│   ├── verifier.ts     3-stage domain verification (DNS/HTTP/WP)
│   ├── detector.ts     Pure WordPress detection (WARC pre-filter)
│   ├── queue.ts        Bounded async queue with backpressure
│   ├── db.ts           Prisma database operations
│   ├── logger.ts       Structured timestamped logger
│   └── config.ts       All tuneable constants
├── prisma/
│   └── schema.prisma   Database schema
├── dist/               ← compiled JS (created by `npm run build`)
├── package.json
└── tsconfig.json
```

### File responsibilities

| File | Responsibility |
|------|---------------|
| `index.ts` | Minimal entry point. Calls `run()` and handles fatal errors. |
| `runner.ts` | Orchestration: WARC producer → bounded queue → N verification workers → DB. |
| `warcParser.ts` | Streams `.warc.gz` over HTTPS, gunzips on the fly, yields `{ targetUri, body }` records. |
| `warcIndex.ts` | Fetches `warc.paths.gz` and yields WARC URLs one at a time (async generator). |
| `verifier.ts` | 3-stage pipeline: DNS resolve → HTTP probe → WordPress checks. Retry with backoff. |
| `detector.ts` | Pure functions: `isWordPressBody()`, `isWordPressUrl()`, `extractOrigin()`, `extractHostname()`. |
| `queue.ts` | `BoundedQueue<T>` — async enqueue/dequeue with backpressure for constant memory. |
| `db.ts` | Prisma wrapper: `insertDomain()`, `countDomains()`, `insertDomains()`, `disconnect()`. |
| `logger.ts` | Structured logger with `[INFO]`, `[STATS]`, `[VERIFY]`, `[REJECT]`, `[WARC]`, `[RETRY]`, `[MEM]` tags. |
| `config.ts` | All constants + env var overrides: targets, concurrency, timeouts, retries, CC crawl ID. |

---

## Setup

### Prerequisites

- Node.js **v18+** (tested on v23) — required for global `fetch()` and `AbortSignal.timeout()`
- npm **v8+**
- PostgreSQL running locally with the `wordpress_finder` database

### Install

```bash
cd worker
npm install
```

### Run (development — via ts-node)

```bash
npm start
```

### Run (compiled — faster for production)

```bash
npm run build
npm run run:compiled
```

---

## Configuration

All settings can be controlled via **environment variables** or by editing `src/config.ts`:

| Variable | Default | Description |
|----------|---------|-------------|
| `VERIFIED_TARGET` | `500` | Stop after this many verified+inserted domains |
| `CONCURRENCY` | `20` | Parallel verification workers |
| `QUEUE_CAPACITY` | `100` | Max items in candidate queue (backpressure) |
| `HTTP_TIMEOUT_MS` | `8000` | HTTP request timeout (ms) |
| `DNS_TIMEOUT_MS` | `5000` | DNS resolution timeout (ms) |
| `MAX_RETRIES` | `2` | Retry transient network failures |
| `CC_CRAWL_ID` | `CC-MAIN-2026-21` | Common Crawl crawl to use |
| `CC_SEGMENT_LIMIT` | `0` | Max WARC segments (0 = unlimited) |
| `LOG_EVERY_N_RECORDS` | `1000` | Progress print frequency |
| `LOG_MEMORY_EVERY` | `5000` | Memory usage print frequency |

### Quick test with fewer domains

```bash
VERIFIED_TARGET=10 CC_SEGMENT_LIMIT=2 npm start
```

---

## Example Log Output

```
[2026-06-24T06:00:00.000Z] [INFO]   Starting verified-domain collector
[2026-06-24T06:00:00.001Z] [INFO]   Target: 500 verified WordPress domains
[2026-06-24T06:00:00.002Z] [INFO]   Concurrency: 20 workers
[2026-06-24T06:00:00.003Z] [INFO]   Queue capacity: 100
[2026-06-24T06:00:00.050Z] [INFO]   Resuming: 20 domains already in database
[2026-06-24T06:00:01.000Z] [INFO]   Fetching WARC index: https://data.commoncrawl.org/…/warc.paths.gz
[2026-06-24T06:00:02.000Z] [WARC]   Starting segment #1: CC-MAIN-…-00000.warc.gz
[2026-06-24T06:00:05.000Z] [CAND]   (1) blog.example.com
[2026-06-24T06:00:06.000Z] [VERIFY] ✓ blog.example.com (wp-json)
[2026-06-24T06:00:06.001Z] [INFO]   [Worker 3] Inserted #21: blog.example.com
[2026-06-24T06:00:07.000Z] [REJECT] ✗ parked-site.net (HTTP_FAIL:HTTP_403)
[2026-06-24T06:00:08.000Z] [RETRY]  slow-site.org attempt 1/3: ECONNRESET
[2026-06-24T06:00:10.000Z] [PROG]   records=1,000  candidates=15
[2026-06-24T06:00:10.001Z] [STATS]  scanned=12 verified=8 rejected=4 inserted=28 duplicates=0
[2026-06-24T06:00:15.000Z] [MEM]    rss=85.2MB  heap=42.1/65.0MB
…
[2026-06-24T06:45:00.000Z] [INFO]   🎯 Target reached! 500/500 verified domains.
[2026-06-24T06:45:00.100Z] [STATS]  scanned=1,842 verified=500 rejected=1,342 inserted=500 duplicates=0
[2026-06-24T06:45:00.101Z] [MEM]    rss=91.0MB  heap=45.3/65.0MB
[2026-06-24T06:45:00.102Z] [DONE]   Finished. inserted=500  verified=500  total_scanned=1842
```

---

## Verification Pipeline Details

Each candidate domain goes through three stages:

### Stage 1: DNS Resolution
- Uses `dns.resolve4()` with a 5-second timeout
- Rejects NXDOMAIN, SERVFAIL, timeout
- Retries on `EAI_AGAIN` (transient DNS failure)

### Stage 2: HTTP Probe
- Fetches `https://{domain}/` with `redirect: manual`
- Accepts only status **200**, **301**, or **302**
- Rejects parked/dead domains (403, 503, timeout, connection refused)
- Reads max 100KB of homepage body (for meta tag scan)

### Stage 3: WordPress Confirmation
- **Meta generator tag** (from homepage body — free, no extra request)
- **`/wp-json/`** — looks for `"namespaces"` or `"wp/v2"` in response
- **`/wp-login.php`** — looks for `"wp-login"` or `"wp-submit"` in body
- **`/wp-content/`** — accepts `200` or `403` (directory listing forbidden but path exists)

A domain passes if **any one** of the four checks succeeds.
