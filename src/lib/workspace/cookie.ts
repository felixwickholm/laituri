import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookieKey } from "@/lib/trust/cookie-key";

/** Holds a random secret that names the browser's sandbox. It is never the sandbox's public label. */
export const WORKSPACE_COOKIE = "laituri_workspace";

/** "shared" while the browser looks at the shared workspace instead of its sandbox. */
export const VIEW_COOKIE = "laituri_view";

/** The secret outlives an idle sandbox, so a returning visitor silently gets a fresh sandbox under the same cookie. */
export const WORKSPACE_COOKIE_MAX_AGE_S = 30 * 24 * 3600;

const SECRET_BYTES = 32;
/** A random secret, a dot, and the server's HMAC of it: only a value this server issued names a sandbox. */
const ISSUED_PATTERN = /^([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/;

function mac(secret: string): string {
  return createHmac("sha256", cookieKey()).update(`laituri-workspace:${secret}`).digest("base64url");
}

/** A new workspace cookie value: a random secret signed with the server's cookie key. */
export function newWorkspaceSecret(): string {
  const secret = randomBytes(SECRET_BYTES).toString("base64url");
  return `${secret}.${mac(secret)}`;
}

/** True only for a value this server issued. A random or edited value is not a secret, so it never makes a sandbox. */
export function isWorkspaceSecret(value: string | undefined): value is string {
  const match = value === undefined ? null : ISSUED_PATTERN.exec(value);
  if (!match) return false;
  const expected = Buffer.from(mac(match[1]));
  const given = Buffer.from(match[2]);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export interface CookieOptions {
  maxAge: number;
  /** Strict for sessions that act; Lax for the workspace, so a link from elsewhere still opens the visitor's own sandbox. */
  sameSite: "Strict" | "Lax";
}

/** A Set-Cookie value: HttpOnly, whole site, Secure in production. */
export function cookieHeader(name: string, value: string, options: CookieOptions): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=${options.sameSite}; Max-Age=${options.maxAge}${secure}`;
}

/** One cookie from a Cookie header. */
export function cookieValue(headers: Headers, name: string): string | undefined {
  const pair = (headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!pair) return undefined;
  try {
    return decodeURIComponent(pair.slice(name.length + 1));
  } catch {
    return undefined;
  }
}

/** Request headers as they will be once the browser stores `setCookie`: that cookie replaced, the others kept. */
export function withCookie(headers: Headers, setCookie: string): Headers {
  const pair = setCookie.split(";")[0];
  const name = pair.slice(0, pair.indexOf("="));
  const others = (headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith(`${name}=`));
  const next = new Headers(headers);
  next.set("cookie", [...others, pair].join("; "));
  return next;
}
