# WordPress Finder — WARC Worker

A standalone **Node.js + TypeScript** worker that streams one Common Crawl WARC
file, detects WordPress sites from the response bodies, and writes 20 unique
WordPress site origins to a text file.

No database, no Docker, no external parsing library — zero production
dependencies.

---

## How It Works

```
HTTPS stream (WARC .gz)
        │
        ▼
  zlib gunzip (in-process)
        │
        ▼
  Buffer accumulator
        │
        ▼  ← sequential record parsing
  WARC record parser
    (filter: WARC-Type=response, HTTP 200, text/html)
        │
        ▼
  WordPress detector
    (body scan for /wp-content/, /wp-login.php, /wp-admin/, /wp-includes/)
        │
        ▼
  Deduplicator  (Set of origins)
        │
        ▼  ← stops at 20 matches & aborts the HTTP stream
  output/wordpress_urls.txt
```

### Why stream instead of download?

WARC files are 700 MB–1 GB each. Streaming means:
- We start finding URLs **within seconds**.
- We **stop the download** the moment we collect 20 matches.
- **No disk space** is wasted storing the full WARC.

---

## Folder Structure

```
worker/
├── src/
│   ├── index.ts        Entry point — boots the runner
│   ├── runner.ts       Orchestration — drives the pipeline
│   ├── warcParser.ts   Streams & parses WARC records (self-contained, no WARC lib)
│   ├── detector.ts     Pure WordPress detection logic
│   ├── output.ts       Writes results to disk
│   ├── logger.ts       Structured timestamped logger
│   └── config.ts       All tuneable constants (URL, limits, paths)
├── output/
│   └── wordpress_urls.txt   ← created when the worker runs
├── dist/               ← compiled JS (created by `npm run build`)
├── package.json
└── tsconfig.json
```

### File responsibilities

| File | Responsibility |
|------|---------------|
| `index.ts` | Minimal entry point. Calls `run()` and handles fatal errors. |
| `runner.ts` | Orchestration loop. Drives parser → detector → deduplicator → output. Has checkpoint TODO stubs. |
| `warcParser.ts` | Streams the `.warc.gz` file over HTTPS, gunzips on the fly, splits WARC records, and yields `{ targetUri, body }` objects for qualifying HTML responses. |
| `detector.ts` | Pure functions: `isWordPressBody()`, `isWordPressUrl()`, `extractOrigin()`. No I/O. |
| `output.ts` | Writes the collected URL array to `output/wordpress_urls.txt`. Has a commented `appendResult()` placeholder for incremental saves. |
| `logger.ts` | Prefixes every log line with an ISO timestamp and severity tag (INFO / PROG / MATCH / DONE / ERROR). |
| `config.ts` | All constants in one place: `WARC_URL`, `MAX_URLS`, `OUTPUT_FILE`, `LOG_EVERY_N_RECORDS`. |

---

## Setup

### Prerequisites

- Node.js **v18+** (tested on v23)
- npm **v8+**

### Install

```bash
cd worker
npm install
```

### Run (development — via ts-node)

```bash
npm start
```

### Run (compiled — faster for repeated use)

```bash
npm run build          # compile TypeScript → dist/
npm run run:compiled   # run dist/index.js
```

---

## Configuration

Edit **`src/config.ts`** to change:

| Constant | Default | Description |
|----------|---------|-------------|
| `WARC_URL` | CC-MAIN-2026-21 segment | The WARC file to process |
| `MAX_URLS` | `20` | Stop after this many distinct WordPress origins |
| `OUTPUT_FILE` | `output/wordpress_urls.txt` | Where results are written |
| `LOG_EVERY_N_RECORDS` | `1000` | Progress print frequency |
| `CHECKPOINT_EVERY` | `0` | (Future) Checkpoint interval |

To process a different WARC file, replace `WARC_URL` with any path from:
```
https://index.commoncrawl.org/CC-MAIN-2026-21-index?url=*&output=json
```
Prefix the `filename` field with `https://data.commoncrawl.org/`.

---

## Output

Results are written to `output/wordpress_urls.txt`, one origin per line:

```
https://example.com
https://another-wp-site.org
...
```

---

## Resumability (Future)

The code is structured so checkpointing can be added with minimal changes:

1. **`config.ts`** — set `CHECKPOINT_EVERY > 0`
2. **`runner.ts`** — uncomment the two TODO blocks to load/save a checkpoint file
3. **`output.ts`** — uncomment `appendResult()` and call it per URL for incremental saves

No other files need to change.

---

## Example Log Output

```
[2026-06-12T09:00:00.000Z] [INFO]  Starting WARC worker
[2026-06-12T09:00:00.001Z] [INFO]  Target file: https://data.commoncrawl.org/...
[2026-06-12T09:00:00.002Z] [INFO]  Goal: collect 20 unique WordPress site origins
[2026-06-12T09:00:03.412Z] [MATCH] (1) https://blog.example.com
[2026-06-12T09:00:04.001Z] [PROG]  records_processed=1,000  matches_found=3
[2026-06-12T09:00:08.881Z] [MATCH] (20) https://another.site.org
[2026-06-12T09:00:08.882Z] [INFO]  Reached 20 URLs — aborting stream to save bandwidth
[2026-06-12T09:00:08.903Z] [PROG]  records_processed=4,213  matches_found=20
[2026-06-12T09:00:08.904Z] [DONE]  Finished. total_matches=20  output=output/wordpress_urls.txt
```
