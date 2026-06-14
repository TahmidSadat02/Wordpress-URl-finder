import { NextResponse } from "next/server";

const COMMON_CRAWL_INDEX = "CC-MAIN-2026-21";
const COMMON_CRAWL_API = `https://index.commoncrawl.org/${COMMON_CRAWL_INDEX}-index`;

const WP_FOOTPRINTS = [
  "/wp-content/",
  "/wp-login.php",
  "/wp-admin/",
  "/wp-includes/",
];

const WP_DOMAINS = [
  "wordpress.com",
  "wpbeginner.com",
  "kinsta.com",
  "wpengine.com",
];

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  }
}

async function fetchFromCommonCrawl(url: string): Promise<string[]> {
  const response = await fetchWithTimeout(url, 8000);

  if (!response.ok) {
    throw new Error(`Common Crawl API responded with ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const urls: string[] = [];

  for (const line of text.trim().split("\n")) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      if (record.url && typeof record.url === "string") {
        urls.push(record.url);
      }
    } catch {
      // Skip malformed JSON lines
    }
  }

  return urls;
}

function hasWordPressFootprint(url: string): boolean {
  if (WP_FOOTPRINTS.some((footprint) => url.includes(footprint))) {
    return true;
  }
  const isWpDomain = WP_DOMAINS.some((domain) => url.includes(domain));
  const isUtility = url.endsWith("robots.txt") || url.endsWith("sitemap.xml") || url.endsWith("favicon.ico") || url.includes("/sitemap");
  return isWpDomain && !isUtility;
}

function deduplicateUrls(urls: string[]): string[] {
  return Array.from(new Set(urls));
}

export async function GET() {
  const allUrls: string[] = [];
  const errors: string[] = [];

  const fetchDomain = async (domain: string): Promise<string[]> => {
    try {
      const queryUrl = `${COMMON_CRAWL_API}?url=${encodeURIComponent(domain)}/*&limit=30&output=json`;
      const urls = await fetchFromCommonCrawl(queryUrl);
      return urls.filter(hasWordPressFootprint);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`${domain}: ${message}`);
      return [];
    }
  };

  for (const domain of WP_DOMAINS) {
    if (allUrls.length >= 20) break;
    const urls = await fetchDomain(domain);
    allUrls.push(...urls);
  }

  const uniqueUrls = deduplicateUrls(allUrls).slice(0, 20);

  if (uniqueUrls.length === 0) {
    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Failed to fetch WordPress URLs from Common Crawl", details: errors },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "No WordPress URLs found in Common Crawl index" },
      { status: 404 }
    );
  }

  return NextResponse.json({ urls: uniqueUrls });
}