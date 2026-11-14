/**
 * The caller's address as the reverse proxy saw it. Assumption: in production the app is reachable only through one
 * trusted proxy (Traefik), which sets X-Real-IP to the connecting address and appends that address to X-Forwarded-For.
 * So X-Real-IP wins; else the right-most X-Forwarded-For entry, the one the proxy added. Entries further left came from
 * the client and can say anything. Without either header (a direct call, a test): "unknown".
 */
export function clientAddress(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .at(-1);
  return forwarded || "unknown";
}
