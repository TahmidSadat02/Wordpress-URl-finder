/**
 * detector.ts
 *
 * Pure WordPress-detection logic — no I/O, no side-effects.
 *
 * Keeping detection isolated here means:
 *  - It's trivial to unit test.
 *  - Footprint patterns are changed in one place (config.ts).
 *  - The parser and the runner never need to know HOW detection works.
 */

import { WP_FOOTPRINTS } from "./config";

/**
 * Returns true if the given HTML body contains at least one WordPress
 * footprint string.
 *
 * @param body - The raw HTTP response body text to scan.
 */
export function isWordPressBody(body: string): boolean {
  for (const footprint of WP_FOOTPRINTS) {
    if (body.includes(footprint)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns true if the given URL itself reveals a WordPress path.
 * (e.g. the crawl captured a direct request to /wp-login.php)
 *
 * @param url - The WARC target URI.
 */
export function isWordPressUrl(url: string): boolean {
  for (const footprint of WP_FOOTPRINTS) {
    if (url.includes(footprint)) {
      return true;
    }
  }
  return false;
}

/**
 * Extract the origin (scheme + host) from a full URL string.
 * Returns null if parsing fails.
 *
 * We store origins rather than full asset paths so that results
 * represent distinct WordPress *sites*, not individual resources.
 *
 * @example
 *   extractOrigin("https://example.com/wp-content/themes/x.css")
 *   // → "https://example.com"
 */
export function extractOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

/**
 * Extract just the hostname from a full URL string.
 * Returns null if parsing fails.
 *
 * Used by the verifier, which works with bare hostnames
 * rather than full origin URLs.
 *
 * @example
 *   extractHostname("https://blog.example.com/wp-content/themes/x.css")
 *   // → "blog.example.com"
 */
export function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
