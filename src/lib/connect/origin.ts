import { headers } from "next/headers";

/** The server's best guess at the public origin, for a page's first render; the browser replaces it with its own. */
export async function serverOrigin(): Promise<string> {
  const list = await headers();
  const host = list.get("x-forwarded-host")?.split(",")[0].trim() || list.get("host") || "localhost:3210";
  const proto = list.get("x-forwarded-proto")?.split(",")[0].trim() || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
