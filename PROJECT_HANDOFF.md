# Project Handoff: WordPress URL Finder & Verifier

This document serves as a comprehensive, production-grade project handoff guide for the **WordPress URL Finder** repository. It is designed to provide another AI assistant or developer with full context, architecture details, implementation mechanics, and developmental history to allow immediate, zero-context-loss continuation of the project.

---

## 1. Project Overview

### What the Project Does
The **WordPress URL Finder** is a self-maintaining domain-discovery platform. It comprises:
1. **A Standalone Node.js + TypeScript Worker**: Streams gzip-compressed Common Crawl Web Archive (WARC) files on the fly, scans raw HTML contents for WordPress footprint signatures, runs a strict 3-stage validation pipeline (DNS resolution $\rightarrow$ HTTP live check $\rightarrow$ WordPress deep verification), and inserts verified domains into a PostgreSQL database.
2. **A Next.js Web Dashboard & API Server**: Exposes REST endpoints to claim unserved domains atomically, reports real-time ingestion status and worker checkpoints, and serves as a responsive visual control center for developers.

### Why It Exists
Acquiring a clean, live, verified list of active WordPress sites is historically hard and resource-intensive. Most scrapers either download massive datasets (hundreds of gigabytes) to disk first, or rely on stale datasets. This project solves that by:
* **Streaming data directly from the cloud** (no disk overhead).
* **Validating domains in real-time** (eliminating dead links, DNS issues, or parked domains).
* **Automating pool replenishment** (when clients consume the domains, the system self-heals by spawning a worker to refill the database).

### Target Users
* **SEO Professionals & Marketers**: Who need lists of active WordPress sites for outreach, guest blogging, or analysis.
* **Security Researchers & Sysadmins**: Looking to audit active WordPress installations or test patch distributions.
* **Data Miners & AI Researchers**: Collecting domains for targeted indexing or training.

### Current Development Stage
The core architecture is **complete and stable**. 
* The worker features a bounded async queue with backpressure, 60-second checkpoint persistence, and graceful shutdown handling.
* The Next.js API features concurrency-safe transaction locks (`FOR UPDATE SKIP LOCKED`) and a background `WorkerManager` that triggers the worker child process reactively.
* The Next.js frontend has a polished glassmorphic UI, responsive tables, copy-to-clipboard functionality, and download tools.

---

## 2. Tech Stack

### Languages & Runtime
* **Language**: TypeScript (strict mode enabled across both directories).
* **Runtime**: Node.js (v18+ required for global `fetch` support and native `AbortSignal` structures).

### Frameworks & Libraries
* **Frontend**: Next.js 16.2.9 (using App Router, CSS modules, React `useClient` Client Components, and standard hooks).
* **Styling**: Vanilla CSS with modern styling tokens, custom dark/light modes using `@media (prefers-color-scheme: dark)`, and tailwind-style animations.
* **Worker & Parsing**:
  * Native Node `https` and `zlib` for decompression streaming.
  * Native Node `child_process` (`spawn`) for background execution.
  * Node `dns` for resolving hosts.
* **Database & Database Tooling**:
  * PostgreSQL (v14+ recommended).
  * Prisma ORM (`@prisma/client` & `prisma` CLI v6.19.3).
  * Node `pg` (v8.21.0) for low-level connection pooling and transactions in Next.js.

### APIs & External Services
* **Common Crawl**: Retrieves the public `warc.paths.gz` index and downloads individual `.warc.gz` segments directly from `https://data.commoncrawl.org`.

### Development & Build Tools
* **TypeScript Compiler**: `tsc` (compiling the worker into `worker/dist`).
* **Linter**: ESLint v9.
* **Build Scripts**: npm scripts for building, running dev, and launching compiled code.

---

## 3. Folder Structure

```
Wordpress URL Finder/           # Repository Root
├── PROJECT_HANDOFF.md          # [THIS FILE] AI-to-AI project handoff documentation
├── .gitignore                  # Global workspace ignores
│
├── wordpress-finder/           # Next.js Frontend & API Application
│   ├── .env.local              # Local environment file (database + inventory variables)
│   ├── .gitignore              # Git ignore rules for Next.js
│   ├── tsconfig.json           # Next.js TypeScript config
│   ├── package.json            # Next.js dependencies and script entries
│   ├── next.config.ts          # Next.js configurations
│   ├── postcss.config.mjs      # PostCSS configurations for Next.js
│   ├── eslint.config.mjs       # Next.js ESLint rules
│   │
│   ├── .vscode/
│   │   └── settings.json       # Editor configurations (suppresses Tailwind v4 lint warnings)
│   │
│   ├── prisma/
│   │   └── schema.prisma       # Database Schema used by Prisma
│   │
│   ├── app/                    # Next.js App Router root
│   │   ├── layout.tsx          # Main html skeleton
│   │   ├── page.tsx            # Main dashboard component
│   │   ├── globals.css         # Global stylesheets & design system variables
│   │   └── api/                # API Endpoints
│   │       ├── domains/
│   │       │   └── route.ts    # GET /api/domains (Claim 50 domains, trigger refill)
│   │       ├── status/
│   │       │   └── route.ts    # GET /api/status (Detailed status of database + worker)
│   │       └── wordpress/
│   │           └── route.ts    # GET /api/wordpress (Legacy/Test endpoint for CC Index API)
│   │
│   ├── components/             # Reusable UI React Components
│   │   ├── Header.tsx          # Title, description, logo
│   │   ├── Loading.tsx         # In-progress loading state spinner
│   │   ├── EmptyState.tsx      # Welcome/unloaded state
│   │   ├── DomainTable.tsx     # Domain grid wrapper
│   │   ├── DomainRow.tsx       # Individual table row with copy button
│   │   └── ActionButtons.tsx   # Copy All, Download TXT, Load More buttons
│   │
│   └── lib/                    # Shared application helpers (Next.js backend)
│       ├── db.ts               # PostgreSQL client pool instance (using pg)
│       ├── prisma.ts           # Singleton Prisma Client (dev-safe against hot-reloads)
│       ├── inventory.config.ts # Environment settings for inventory limits
│       ├── inventory.service.ts# Data-access methods for domain counts and state checks
│       ├── inventory.types.ts  # Shared TypeScript interfaces for API payloads
│       └── worker.manager.ts   # Process manager to start/stop the worker child process
│
└── worker/                     # Standalone Common Crawl Worker
    ├── .env                    # Local environment file (database connection string)
    ├── .gitignore              # Git ignore rules for worker
    ├── tsconfig.json           # Worker TypeScript compiler options
    ├── package.json            # Worker dependency list & commands
    ├── checkpoint.json         # [GENERATED] Saved segment/offset of current stream
    │
    ├── prisma/                 # Duplicated schema structure to compile client
    │   ├── schema.prisma       # Prisma schema (matches Next.js application schema)
    │   └── migrations/         # Database migrations directory
    │       └── 20260615085014_init/
    │           └── migration.sql # Initial SQL schema creation script
    │
    └── src/                    # Worker source code
        ├── index.ts            # Entry point (boots runner)
        ├── runner.ts           # Orchestrates stream parsing, queue, and verification loop
        ├── warcIndex.ts        # Async generator fetching index file paths
        ├── warcParser.ts       # Gzip streaming & WARC record block reader
        ├── detector.ts         # WordPress footprints checks & URL origin utility methods
        ├── verifier.ts         # DNS lookup, HTTP fetch, and live WordPress probe execution
        ├── queue.ts            # Custom Bounded Async FIFO Queue with backpressure
        ├── db.ts               # Database CRUD layer (Prisma connection)
        ├── logger.ts           # Structured logging utility with runtime summaries
        ├── config.ts           # Config variables parsed from env
        ├── checkpoint.ts       # Handles saving/loading checkpoint files
        └── cancellation.ts     # AbortController wrapper for global thread stoppage
```

---

## 4. Architecture

The system is split into two logical domains running against a shared PostgreSQL database:
1. **The Ingestion Plane (Worker)**: A pipeline that pulls from the Common Crawl index and populates PostgreSQL.
2. **The Client Plane (API & UI)**: Next.js frontend and JSON endpoints that read from and claim records in the database.

```mermaid
graph TD
    %% Define components
    subgraph Client Plane (Next.js UI & Server)
        UI[page.tsx Dashboard]
        APIDomains[GET /api/domains]
        APIStatus[GET /api/status]
        WM[worker.manager.ts]
    end

    subgraph Database
        DB[(PostgreSQL)]
    end

    subgraph Ingestion Plane (Worker Process)
        Index[warcIndex.ts]
        Parser[warcParser.ts]
        Queue[queue.ts BoundedQueue]
        Verifier[verifier.ts]
        WorkerDB[db.ts Prisma]
        Checkpoint[checkpoint.json]
    end

    %% Client Interactions
    UI -->|fetch| APIDomains
    UI -->|fetch| APIStatus
    APIDomains -->|Transaction FOR UPDATE SKIP LOCKED| DB
    APIDomains -->|Reactive triggering if count < LOW_WATER_MARK| WM
    APIStatus -->|Read status counts| DB
    APIStatus -->|Read checkpoint status| Checkpoint
    WM -->|spawn child process| Index

    %% Ingestion Flow
    Index -->|Iterates WARC Paths| Parser
    Parser -->|Streams raw WARC records| Queue
    Queue -->|Backpressure blocks producer| Parser
    Queue -->|Dequeues to N threads| Verifier
    Verifier -->|Probes target domain| Internet((The Internet))
    Verifier -->|If WordPress & Verified| WorkerDB
    WorkerDB -->|Insert or Recycle| DB
    Index -->|Periodically saves state| Checkpoint
```

### 1. Frontend Architecture
The user interface is built as a single-page dashboard.
* It uses React state hooks (`useState` and `useCallback`) to manage loaded domains, loading spinners, errors, and button animations.
* When the dashboard loads or when the user clicks **Get Domains**, a fetch request is sent to `GET /api/domains`. This replaces the current domain list.
* Clicking **Load More** calls the same API but appends results to the existing array in state, using a `Set` to deduplicate any items.
* Utility components like `ActionButtons` handle copy actions (using `navigator.clipboard.writeText`) and text generation for file downloads.

### 2. Backend Architecture
The backend is powered by Next.js API Routes.
* **Connection Pooling**: Uses the `pg` library's `Pool` directly in the `/api/domains` endpoint to perform high-speed transaction queries, which bypasses the Prisma Client overhead.
* **Process Separation**: The background crawler is a resource-intensive task. Instead of running it in the Next.js process thread (which would block API routes and cause timeout crashes on serverless platforms), the API uses `worker.manager.ts` to spawn the compiled worker as a background child process via Node's `spawn`.
* **Process Lifecycle**: The manager handles forwarding child `stdout` and `stderr` logs to the server console and updates its internal status when the child exits.

### 3. Worker Architecture
The worker is structured as a **single-producer, multi-consumer pipeline**:
* **Producer**: `warcParser.ts` streams a remote gzip file from Common Crawl, unzips it in memory chunk-by-chunk, reads WARC records, extracts the hostname, checks for basic WordPress markers, and places matching hostnames in `BoundedQueue`.
* **Queue**: Acts as a buffer between the network-heavy WARC streaming and the latency-heavy live domain checking.
* **Consumers**: $N$ concurrent workers (`VERIFY_CONCURRENCY`, default 20) read from the queue, run the 3-stage validation, and write valid entries to the database.

### 4. Database Architecture
PostgreSQL is the single source of truth.
* It contains a single table: `discovered_domains`.
* The design uses a unique index on the `domain` column. This makes it impossible for duplicates to be inserted.
* Transactions use row-level locking so that concurrent server threads claiming domains never collide.

### 5. API Architecture
Restful endpoints return JSON payloads. The claim endpoint (`/api/domains`) uses a database transaction to lock up to 50 domains and mark them as served in a single atomic step.

### 6. Inventory & Refill System
* **Monitoring**: Every time a batch of domains is claimed from `GET /api/domains`, the server runs a background check to check how many unserved domains are left.
* **Refill**: If the count is below `LOW_WATER_MARK` (100) and no worker process is currently running, the server spawns the worker in the background. The worker continues running until the unserved count is at least `REFILL_TARGET` (500).

### 7. Verification Pipeline
To prevent dead, parked, or non-WordPress domains from cluttering the database, candidate domains go through a live verification process:
1. **DNS resolve**: Check if the host has valid IPv4 addresses via `dns.resolve4`.
2. **HTTP probe**: Perform a GET request to the homepage. Confirm it returns status `200`, `301`, or `302`.
3. **WordPress check**: Scan the page for a `<meta name="generator" content="WordPress ...">` tag, or probe `/wp-json/`, `/wp-login.php`, or `/wp-content/`.

### 8. Concurrency Model
The worker utilizes a custom `BoundedQueue<T>` with a configurable limit (`QUEUE_SIZE`).
* If the workers are slow to verify domains, the queue fills up to `QUEUE_SIZE` (default 100), and the producer **waits (blocks)** from pulling more data from the WARC stream. This prevents the worker from using too much RAM.
* If the queue is empty, the workers sleep until new items are enqueued.

### 9. Checkpoint System
Ingesting a 1GB WARC file takes time. To avoid losing progress if the worker is stopped or crashes:
* Every 60 seconds, the worker saves its progress (WARC file path, current record offset, and number of verified domains) to `worker/checkpoint.json`.
* At startup, the worker checks if `checkpoint.json` exists. If it does, it skips past processed records and resumes immediately.
* When the target is reached, the worker deletes `checkpoint.json`.

---

## 5. Database Schema

The database consists of a single table, `discovered_domains` (mapped to Prisma model `DiscoveredDomain`), defined in [schema.prisma](file:///Users/laptopparadise/Documents/Wordpress%20URL%20Finder/wordpress-finder/prisma/schema.prisma).

### Prisma Model Specification
```prisma
model DiscoveredDomain {
  id           BigInt    @id @default(autoincrement())
  domain       String    @unique
  sourceWarc   String?
  discoveredAt DateTime  @default(now())
  served       Boolean   @default(false)
  servedAt     DateTime?

  @@map("discovered_domains")
}
```

### SQL Schema (`20260615085014_init/migration.sql`)
```sql
CREATE TABLE "discovered_domains" (
    "id" BIGSERIAL NOT NULL,
    "domain" TEXT NOT NULL,
    "sourceWarc" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "served" BOOLEAN NOT NULL DEFAULT false,
    "servedAt" TIMESTAMP(3),

    CONSTRAINT "discovered_domains_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "discovered_domains_domain_key" ON "discovered_domains"("domain");
```

### Column Explanations
* `id` (`BIGINT`, Autoincrementing Primary Key): Identifies the record. `BIGINT` is used to prevent integer overflow in large datasets.
* `domain` (`TEXT`, Unique): The host address (e.g. `blog.example.com`). The unique constraint ensures that the same domain is never stored twice.
* `sourceWarc` (`TEXT`, Nullable): Stash the URL of the `.warc.gz` file where this domain was found. Useful for debugging and traceability.
* `discoveredAt` (`TIMESTAMP`, Default `NOW()`): Timestamp of when the worker verified and inserted the domain.
* `served` (`BOOLEAN`, Default `false`): Flags whether this domain has been claimed via the Next.js API.
* `servedAt` (`TIMESTAMP`, Nullable): Stalls the timestamp when the domain was marked as served.

---

## 6. API Documentation

### 1. Claim Domains
* **Route**: `/api/domains`
* **Method**: `GET`
* **Query Parameters**: None
* **Headers**: None
* **Response (200 OK)**:
  ```json
  {
    "domains": [
      "domain1.com",
      "domain2.org",
      "..."
    ]
  }
  ```
* **Response (404 Not Found)**:
  ```json
  {
    "error": "No domains available"
  }
  ```
* **Response (500 Internal Error)**:
  ```json
  {
    "error": "Database error details..."
  }
  ```
* **Internal Flow**:
  1. Opens a database client connection from the `pg` pool.
  2. Runs a SQL transaction with `BEGIN`.
  3. Executes an atomic query:
     ```sql
     UPDATE "discovered_domains"
     SET "served" = TRUE, "servedAt" = NOW()
     WHERE "id" IN (
         SELECT "id" FROM "discovered_domains"
         WHERE "served" = FALSE
         ORDER BY "discoveredAt" ASC
         LIMIT 50
         FOR UPDATE SKIP LOCKED
     ) RETURNING "domain";
     ```
  4. Commits the transaction (`COMMIT`).
  5. If rows are found, returns them as a JSON array.
  6. Launches a non-blocking background check (`checkAndRefill()`) to see if the unserved pool is low. If the count is below `LOW_WATER_MARK` and no worker is running, it spawns a worker process.
  7. Releases the database client.
* **Related Files**:
  * [domains/route.ts](file:///Users/laptopparadise/Documents/Wordpress%20URL%20Finder/wordpress-finder/app/api/domains/route.ts)
  * [inventory.service.ts](file:///Users/laptopparadise/Documents/Wordpress%20URL%20Finder/wordpress-finder/lib/inventory.service.ts)
  * [worker.manager.ts](file:///Users/laptopparadise/Documents/Wordpress%20URL%20Finder/wordpress-finder/lib/worker.manager.ts)

---

### 2. System Status
* **Route**: `/api/status`
* **Method**: `GET`
* **Response (200 OK)**:
  ```json
  {
    "remaining": 420,
    "served": 80,
    "refilling": true,
    "workerStatus": "running",
    "verifiedTarget": 500,
    "lastCheckpoint": {
      "warcPath": "https://data.commoncrawl.org/crawl-data/CC-MAIN-2026-21/segments/...warc.gz",
      "recordOffset": 15420,
      "verifiedCount": 35,
      "timestamp": "2026-07-03T12:00:00.000Z"
    },
    "verificationRate": 0.16
  }
  ```
* **Internal Flow**:
  1. Executes two SQL queries in parallel to get the counts for `served = false` and `served = true`.
  2. Queries the singleton `workerManager` state to check if the child process is running.
  3. Reads `worker/checkpoint.json` from disk (if present) to parse crawler progress.
  4. Merges the results and returns the JSON payload.
* **Related Files**:
  * [status/route.ts](file:///Users/laptopparadise/Documents/Wordpress%20URL%20Finder/wordpress-finder/app/api/status/route.ts)
  * [inventory.service.ts](file:///Users/laptopparadise/Documents/Wordpress%20URL%20Finder/wordpress-finder/lib/inventory.service.ts)

---

### 3. Direct Fetch Test (Legacy)
* **Route**: `/api/wordpress`
* **Method**: `GET`
* **Response (200 OK)**:
  ```json
  {
    "urls": [
      "https://wordpress.com/wp-content/...",
      "..."
    ]
  }
  ```
* **Internal Flow**:
  1. Hits the Common Crawl index API for a list of hardcoded WordPress domains (`wordpress.com`, `wpbeginner.com`, `kinsta.com`, `wpengine.com`).
  2. Parses the JSON-lines output.
  3. Filters URLs containing WordPress footprints.
  4. Returns the first 20 unique URLs found.
* **Related Files**:
  * [wordpress/route.ts](file:///Users/laptopparadise/Documents/Wordpress%20URL%20Finder/wordpress-finder/app/api/wordpress/route.ts)

---

## 7. Worker Documentation

### Process Life Cycle

```mermaid
stateDiagram-v2
    [*] --> Startup
    Startup --> LoadCheckpoint : Check for checkpoint.json
    LoadCheckpoint --> FetchCCIndex : Find next segment URL
    FetchCCIndex --> StreamSegment : Fetch .warc.gz from Common Crawl
    
    state StreamSegment {
        [*] --> GunzipStream : Pipe HTTPS stream
        GunzipStream --> ParseRecords : Decompress and extract records
        ParseRecords --> FilterWP : Look for /wp-content/ or URLs
        FilterWP --> BoundedQueue : Push match (Enqueue blocks if full)
    }

    state ConcurrentVerification {
        [*] --> DequeueCandidate
        DequeueCandidate --> DNSResolve : Stage 1
        DNSResolve --> HTTPProbe : Stage 2
        HTTPProbe --> WordPressConfirm : Stage 3
        WordPressConfirm --> DBWrite : Success
        DBWrite --> CheckRefillTarget : Insert or Recycle
    }

    StreamSegment --> ConcurrentVerification : Enqueue candidate
    CheckRefillTarget --> [*] : Unserved >= REFILL_TARGET reached
    CheckRefillTarget --> StreamSegment : Target not met (Continue stream)
```

### Detailed Functional Steps

#### 1. Startup & Resume
On start, the worker queries the database to count how many unserved domains are present. If the unserved count is already greater than or equal to `REFILL_TARGET`, the worker exits immediately.
Next, it looks for `checkpoint.json` in the worker root. If found, it parses the saved state (the last WARC segment URL and record index). The producer will skip segments and records until it reaches this saved index.

#### 2. Index Fetching
The worker contacts `https://data.commoncrawl.org/crawl-data/{CC_CRAWL_ID}/warc.paths.gz` (based on `CC_CRAWL_ID` from config). It decompresses the file and iterates through the index paths line-by-line, filtering for `.warc.gz` files.

#### 3. Streaming and Parsing WARC Records
The worker downloads individual WARC segments over HTTPS. The stream is piped into `zlib.createGunzip()` to decompress it in memory. The stream parser looks for double CRLF boundaries (`\r\n\r\n`) to parse the WARC header and payload fields.
* It skips records where `WARC-Type` is not `response`.
* It skips records where the HTTP status code is not `200`.
* It skips records where the `Content-Type` is not `text/html`.

#### 4. WordPress Detection (Pre-filter)
To avoid running DNS and HTTP queries for every page in a WARC file, a quick pre-filter checks the body text and target URL for WordPress keywords:
* `/wp-content/`
* `/wp-login.php`
* `/wp-admin/`
* `/wp-includes/`

If a record matches any of these keywords, the worker extracts its hostname. If the hostname has not been seen during this run (tracked via `seenCandidates` `Set`), it is added to the candidate queue.

#### 5. Bounded Queue & Concurrency
The queue uses a Promise-based FIFO buffer with a maximum capacity (`QUEUE_SIZE`, default 100).
* **Enqueue**: If the queue is full, the producer blocks on `await queue.enqueue(...)`. This pauses decompression, creating backpressure that slows down network downloads.
* **Dequeue**: $N$ concurrent workers run in parallel, calling `await queue.dequeue()`.

#### 6. 3-Stage Verification Pipeline
For each candidate domain, a worker runs the following checks:
1. **DNS resolve**: Checks if the domain has a valid IPv4 address via `dns.resolve4`. Times out after `DNS_TIMEOUT_MS` (5 seconds). Retries on `EAI_AGAIN` error codes.
2. **HTTP probe**: Sends a GET request to `https://{domain}/` with manual redirect handling and a User Agent header. Only status `200`, `301`, and `302` are allowed. To save bandwidth and memory, the client reads at most the first 100KB of the response body.
3. **WordPress Check**:
   * Inspects the homepage HTML for a `<meta name="generator" content="WordPress ...">` tag.
   * If not found, it sends queries to `/wp-json/` (looking for `"namespaces"` or `"wp/v2"`), `/wp-login.php` (looking for `"wp-login"` or `"wp-submit"`), and `/wp-content/` (accepts `200` or `403`).
   * The domain is verified if **any** of these checks succeed.

#### 7. Database Writes
Verified domains are written to PostgreSQL using Prisma. If the insertion succeeds, the verified counter is incremented.
If the insertion fails because the domain already exists (unique constraint violation `P2002`):
* If the domain has already been served (`served: true`), the system updates the record to `served = false` and `servedAt = null`. This recycles the domain back into the pool.
* If the domain is already in the pool but unserved, it is logged as a duplicate.

#### 8. Graceful Shutdown & Cancellation
The worker listens for `SIGINT` and `SIGTERM` signals.
* When a signal is caught, it triggers the `CancellationController` to abort all active network calls and DNS queries.
* The queue is cleared and closed, which causes the workers to exit once they finish their current task.
* The worker writes a final checkpoint to `checkpoint.json` and disconnects the database client before exiting.

---

## 8. File Index

### 1. Next.js Application (`wordpress-finder/`)

#### [app/api/domains/route.ts](file:///Users/laptopparadise/Documents/Wordpress%20URL%20Finder/wordpress-finder/app/api/domains/route.ts)
* **Purpose**: Claims up to 50 unserved domains. Triggers a background refill check.
* **Public Exports**: `GET` handler.
* **Dependencies**: `pg` Pool (`lib/db.ts`), `shouldRefill` (`lib/inventory.service.ts`), `workerManager` (`lib/worker.manager.ts`).
* **Callers**: React frontend (`app/page.tsx`).
* **Details**: Uses `FOR UPDATE SKIP LOCKED` inside a SQL transaction to prevent concurrent client requests from claiming the same domains.

#### [lib/worker.manager.ts](file:///Users/laptopparadise/Documents/Wordpress%20URL%20Finder/wordpress-finder/lib/worker.manager.ts)
* **Purpose**: Spawns and manages the worker process.
* **Public Exports**: `workerManager` singleton instance.
* **Dependencies**: `child_process.spawn`, `path`, `REFILL_TARGET` (`lib/inventory.config.ts`), `inventory.types.ts`.
* **Callers**: `api/domains/route.ts`, `inventory.service.ts`.
* **Details**: Cached on `globalThis.__workerManager` in development to survive Next.js module hot-reloads. Spawns `node worker/dist/index.js` in a child process.

#### [lib/inventory.service.ts](file:///Users/laptopparadise/Documents/Wordpress%20URL%20Finder/wordpress-finder/lib/inventory.service.ts)
* **Purpose**: Queries domain counts from the database and reads the worker checkpoint.
* **Public Exports**: `getRemainingDomains`, `getServedDomains`, `shouldRefill`, `getWorkerStatus`, `getFullStatus`.
* **Dependencies**: `fs`, `path`, `pg` Pool, config constants, `workerManager`, types.
* **Callers**: `/api/domains/route.ts`, `/api/status/route.ts`.
* **Details**: Reads the worker's checkpoint file (`../worker/checkpoint.json`) to surface real-time crawler progress to the status API.

---

### 2. Standalone Worker (`worker/`)

#### [src/runner.ts](file:///Users/laptopparadise/Documents/Wordpress%20URL%20Finder/worker/src/runner.ts)
* **Purpose**: The main coordinator for the worker pipeline.
* **Public Exports**: `run()` function.
* **Dependencies**: Config constants, detector utilities, database client, verifier, queue, checkpoint manager, stream parsers.
* **Callers**: `index.ts` bootstrap.
* **Details**: Coordinates the producer/consumer pipeline. Sets up timers to write `checkpoint.json` every 60 seconds and registers `SIGINT`/`SIGTERM` handlers for graceful shutdowns.

#### [src/warcParser.ts](file:///Users/laptopparadise/Documents/Wordpress%20URL%20Finder/worker/src/warcParser.ts)
* **Purpose**: Streams and parses remote WARC files.
* **Public Exports**: `streamWarcRecords()` async generator.
* **Dependencies**: `https`, `zlib`, `stream`.
* **Callers**: `runner.ts`.
* **Details**: Downloads a `.warc.gz` file over HTTPS, gunzips it on the fly, and parses individual record envelopes. Returns only HTTP `200` responses with `text/html` bodies.

#### [src/verifier.ts](file:///Users/laptopparadise/Documents/Wordpress%20URL%20Finder/worker/src/verifier.ts)
* **Purpose**: Runs the 3-stage validation pipeline on candidate hostnames.
* **Public Exports**: `verifyDomain()`.
* **Dependencies**: `dns`, config constants, logger.
* **Callers**: `runner.ts` consumers.
* **Details**: Resolves DNS records, checks HTTP status codes (200, 301, 302), and probes WordPress paths. Uses exponential backoff to retry transient network errors.

#### [src/queue.ts](file:///Users/laptopparadise/Documents/Wordpress%20URL%20Finder/worker/src/queue.ts)
* **Purpose**: A thread-safe bounded FIFO queue with backpressure support.
* **Public Exports**: `BoundedQueue` class.
* **Dependencies**: None.
* **Callers**: `runner.ts`.
* **Details**: If the queue reaches capacity, the enqueuer blocks. If the queue is empty, the dequeuers wait. Supports pause, resume, clear, and close operations.

---

## 9. Environment Variables

### Next.js API Server (`wordpress-finder/.env.local`)
| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string with schema set. | `postgresql://postgres:123456@localhost:5432/wordpress_finder?schema=public` |
| `LOW_WATER_MARK` | Refill threshold. When remaining domains drop below this, a refill is triggered. | `100` |
| `REFILL_TARGET` | How many verified domains the worker should collect. | `500` |
| `CHECK_INTERVAL` | Milliseconds between periodic inventory checks. | `60000` |

### Worker Process (`worker/.env`)
| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string. | `postgresql://postgres:123456@localhost:5432/wordpress_finder?schema=public` |
| `TARGET` | Stop crawler when verified count reaches this. | `500` |
| `REFILL_TARGET` | Kept for compatibility, behaves identically to `TARGET`. | `500` |
| `VERIFY_CONCURRENCY`| Number of concurrent verification workers. | `20` |
| `QUEUE_SIZE` | Maximum queue depth before backpressure blocks the stream. | `100` |
| `HTTP_TIMEOUT` | Timeout in milliseconds for HTTP probe requests. | `8000` |
| `DNS_TIMEOUT` | Timeout in milliseconds for DNS resolution. | `5000` |
| `RETRY_COUNT` | Number of times to retry transient network errors. | `2` |
| `CC_CRAWL_ID` | The Common Crawl crawl ID to use. | `CC-MAIN-2026-21` |
| `CC_SEGMENT_LIMIT` | Maximum number of WARC segments to process. `0` means run until target. | `0` |
| `PROGRESS_INTERVAL` | Number of records between progress logs. | `1000` |
| `LOG_MEMORY_EVERY` | Number of records between memory usage logs. | `5000` |
| `CHECKPOINT_FILE` | The file name used to store checkpoint state. | `checkpoint.json` |

---

## 10. Build & Run Instructions

### Prerequisites
* Node.js v18+ installed on your machine.
* A PostgreSQL instance running with a database named `wordpress_finder`.

### Database Setup
To initialize the database tables:
1. Navigate to the worker directory:
   ```bash
   cd worker
   ```
2. Apply the database migrations:
   ```bash
   npx prisma migrate dev
   ```

---

### Running the Next.js App
1. Go to the Next.js application directory:
   ```bash
   cd wordpress-finder
   ```
2. Install the application dependencies:
   ```bash
   npm install
   ```
3. Run the Next.js development server:
   ```bash
   npm run dev
   ```
   The dashboard will be available at `http://localhost:3000`.

---

### Running the Worker (Standalone)
You can run the worker separately from the web application.

#### Development Mode (Using ts-node)
1. Navigate to the worker directory:
   ```bash
   cd worker
   ```
2. Install the worker dependencies:
   ```bash
   npm install
   ```
3. Start the worker process:
   ```bash
   npm start
   ```

#### Production Mode (Compiled JS)
For better performance during long crawls:
1. Compile the TypeScript files:
   ```bash
   npm run build
   ```
2. Run the compiled JavaScript files:
   ```bash
   npm run run:compiled
   ```

---

## 11. Completed Work Checklist

- [x] **Phase 1: Initial Setup**
  * Bootstrapped the Next.js application.
  * Configured ESLint, Prettier, TypeScript, and the base project structure.
  * Designed the database schema and ran migrations using Prisma.
- [x] **Phase 2: Core Worker Engine**
  * Implemented WARC path index iteration.
  * Created the streaming gzip parser to extract records from remote files.
  * Built the WordPress footprint detection engine.
- [x] **Phase 3: Verification Pipeline & Concurrency**
  * Added DNS resolution with custom timeout handling.
  * Built the homepage HTTP prober.
  * Added verification probes for `/wp-json/`, `/wp-login.php`, and `/wp-content/`.
  * Implemented custom `BoundedQueue` to provide backpressure.
- [x] **Phase 4: Checkpointing & Reliability**
  * Added a timer to write checkpoints to `checkpoint.json` every 60 seconds.
  * Implemented startup logic to parse checkpoints and resume crawling.
  * Added signal handlers (`SIGINT`/`SIGTERM`) to trigger graceful shutdowns and save a final checkpoint.
- [x] **Phase 5: Next.js API & Process Management**
  * Wrote `/api/domains` endpoint using `pg` transactions and row-level locking.
  * Created `WorkerManager` to spawn and monitor the worker process.
  * Implemented recycling logic to reuse domains when re-crawling datasets.
- [x] **Phase 6: Frontend & Polishing**
  * Designed a responsive dashboard layout.
  * Added buttons to claim domains, load more, copy results, and download text files.
  * Silenced Tailwind CSS v4 `@theme` compiler warnings in VS Code.

---

## 12. Known Issues & Bugs

There are no unresolved runtime bugs or database conflicts. 

| Symptoms | Root Cause | Affected Files | Status |
| :--- | :--- | :--- | :--- |
| Next.js dev server would spawn multiple worker instances during hot-reloads. | Hot-reloads reload modules, which recreated the `WorkerManager` and its reference list. | `lib/worker.manager.ts` | **Fixed**: Cached the manager instance on `globalThis.__workerManager`. |
| VS Code showed a linting warning: `Unknown at rule @theme` on `globals.css:4`. | VS Code's standard CSS extension doesn't recognize the new `@theme` rule from Tailwind v4. | `app/globals.css` | **Fixed**: Configured `.vscode/settings.json` to ignore unknown at-rules. |

---

## 13. Future Roadmap

These features are planned for future development, ordered by priority:
1. **Scheduled Polling (Cron Refills)**: Add a cron job that checks remaining domains periodically, instead of relying on requests to `/api/domains` to trigger refills.
2. **Dashboard Ingestion Metrics**: Expand the web dashboard to show real-time stats (crawler throughput, verified vs rejected rates, current WARC file).
3. **Advanced Filtering**: Add features to filter and search the domain list by discovery date or source WARC.
4. **CSV Export Support**: Allow users to download domain lists as a CSV file with additional metadata (discovery date, source WARC).

---

## 14. Important Design Decisions

### 1. RAM Optimization: Streaming vs. Downloading WARC
Downloading a single Common Crawl segment (which can be over 1GB) to disk uses significant bandwidth and storage. Instead, the worker streams the file over HTTPS and decompresses it in memory. This allows the worker to start finding domains within seconds, uses no disk space, and keeps memory usage constant.

### 2. Concurrency Control: Bounded Queue Backpressure
Without backpressure, the fast gzip streamer could decompress records quicker than the network workers could verify them. This would build up millions of strings in memory and cause an Out-Of-Memory (OOM) crash. The custom `BoundedQueue` solves this: when the queue reaches capacity (100 items), the producer blocks until a consumer frees up space.

### 3. Dev Server Stability: globalThis Singletons
In development, Next.js hot-reloads files when changes are saved. This would re-initialize the `pg` Pool and spawn multiple worker processes, exhausting database connections and CPU. To prevent this, the `WorkerManager`, Prisma Client, and `pg` Pool instances are attached to `globalThis` to preserve them across reloads.

### 4. Database Reliability: Row-Level Locking
To prevent concurrent requests to `/api/domains` from claiming the same domains, the query uses `FOR UPDATE SKIP LOCKED`. This locks the claimed rows and skips any rows already locked by other transactions, preventing race conditions.

### 5. Loop Prevention: Recycling Served Domains
When the database is empty of unserved domains, the worker may parse the same WARC segment and discover the same domains again. If the database simply ignored these as duplicates, the count of unserved domains would never increase. To fix this, when the database detects a duplicate domain that has already been served (`served = true`), it resets the record to `served = false` so it can be claimed again.

---

## 15. AI Development History

During development, several prompts and goals guided the AI coding assistant:
1. **Repository Restructuring**: Moved the Next.js app and standalone worker to the root level. Set up directories to support running the worker as a background child process.
2. **Atomic Queue Locking**: Implemented the transaction query using `FOR UPDATE SKIP LOCKED` to allow multiple frontend clients to safely query the database at the same time.
3. **Checkpoint & Resume Implementation**: Added `checkpoint.json` logic. Set up interval timers to save state, and wrote skip logic to skip records when resuming from a checkpoint.
4. **Child Process Manager**: Wrote `WorkerManager` to allow the Next.js application to safely start and stop the worker using OS signals.

---

## 16. Coding Standards

* **TypeScript**: Use strict type definitions. Avoid using `any` types. Let the compiler infer types where possible.
* **Naming Conventions**: Use `camelCase` for variables and functions, `PascalCase` for classes and types, and `UPPER_SNAKE_CASE` for configuration constants.
* **Error Handling**: 
  * Wrap database queries and network fetches in `try-catch` blocks.
  * In the worker, log transient network issues as warning retries instead of crashing.
  * Ensure API endpoints always return descriptive JSON error responses.
* **Logging**: Use the structured logger (`logger.ts`) in the worker. All logs should include a timestamp and a tag (e.g. `[INFO]`, `[VERIFY]`, `[REJECT]`).
* **Do Not Modify**: 
  * Do not remove the `FOR UPDATE SKIP LOCKED` transaction logic in `/api/domains`.
  * Do not remove the `globalThis` caching logic in `WorkerManager` or database clients.

---

## 17. Dependency Graph

The dependencies between project modules:

```
[Next.js API Server]
  ├── domains/route.ts
  │     ├── db.ts (pg Pool)
  │     ├── inventory.service.ts
  │     │     ├── db.ts (pg Pool)
  │     │     └── worker.manager.ts
  │     │           └── (spawns worker child process)
  │     └── worker.manager.ts
  └── status/route.ts
        └── inventory.service.ts

[Worker Process]
  └── index.ts
        └── runner.ts
              ├── config.ts
              ├── logger.ts
              ├── db.ts (Prisma Client)
              ├── cancellation.ts
              ├── checkpoint.ts
              ├── queue.ts
              ├── detector.ts
              ├── warcIndex.ts
              ├── warcParser.ts
              └── verifier.ts
                    ├── config.ts
                    └── logger.ts
```

---

## 18. Development History

* **d8d1d05 & 1fd1018 (Initial Commits)**: Bootstrapped the initial Next.js application and git configuration files.
* **f6bc453 (Restructure Repo & Worker)**: Created the root-level directories (`wordpress-finder` and `worker`) and implemented the streaming parser.
* **919e7d6 (Prisma Setup)**: Wrote the initial database schema and created the migrations.
* **cf533c6 & 3f616ca (Domains API)**: Implemented `/api/domains` with atomic transaction locking.
* **a1435ba (UI & Pipeline Improvements)**: Built the dashboard interface and refined the verification pipeline.
* **3cfb4f2 (Checkpoint System)**: Added state checkpointing to allow the worker to resume from failures.
* **5025a7b, 1b4cd86 & 2600cd9 (Worker Refill Logic)**: Connected the web application to the worker, enabling the system to trigger refills automatically.
* **3f62a9c (VS Code Settings)**: Configured the workspace settings to support Tailwind CSS v4 without linting errors.

---

## 19. Next Steps

1. **Scheduled Polling (Cron Refill)**
   * Set up a recurring background check (using standard cron schedules or Next.js background workers) to trigger refills, removing the reliance on user requests to trigger checks.
2. **Dashboard metrics dashboard**
   * Build a status UI on the dashboard page using the data from `/api/status`, showing graphs of current progress and domain statistics.
3. **Refill control panel**
   * Add interactive **Start Refill** and **Stop Refill** buttons to the frontend dashboard, allowing developers to control the worker directly from the UI.

---

## 20. Repository Audit

An audit of the repository identified these items:
* **Unused API Route**: [wordpress/route.ts](file:///Users/laptopparadise/Documents/Wordpress%20URL%20Finder/wordpress-finder/app/api/wordpress/route.ts) is not referenced by any frontend components or other files. It should be kept as a utility for directly querying the CC Index API, or removed if no longer needed.
* **Unused Code**: `insertDomains` (plural) in `worker/src/db.ts` is not called anywhere in the worker pipeline. It is kept for backwards compatibility but can be safely removed.
* **Process Termination**: When Next.js stops, any active worker child processes may continue running. The application should handle `process.on('exit')` to ensure child processes are terminated cleanly when the server shuts down.
