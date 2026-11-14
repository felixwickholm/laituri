import type { MetadataRoute } from "next";
import { LIVE_URL } from "@/lib/evidence";

/**
 * Every crawler, AI assistants included, may read the public pages, the discovery documents and the API description.
 * Approval links are personal and stay out. Note: the live server also sends an X-Robots-Tag header, which is a
 * deployment setting outside this file.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/approve/"] }],
    sitemap: `${LIVE_URL}/sitemap.xml`,
    host: LIVE_URL,
  };
}
