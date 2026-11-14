import { catalog } from "@/lib/catalog";

/** Catalogue readiness without failing the health check when the index has not been built yet. */
export function catalogStatus(): { ready: boolean; size: number } {
  try {
    const size = catalog().size;
    return { ready: size > 0, size };
  } catch {
    return { ready: false, size: 0 };
  }
}
