import type { MetadataRoute } from "next";
import { PUBLIC_PATHS } from "@/lib/discovery/pages";
import { LIVE_URL } from "@/lib/evidence";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({ url: `${LIVE_URL}${path}` }));
}
