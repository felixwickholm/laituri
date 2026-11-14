/** The caller's address as the reverse proxy reports it: the first X-Forwarded-For entry, else X-Real-IP, else "unknown". */
export function clientAddress(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0].trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
