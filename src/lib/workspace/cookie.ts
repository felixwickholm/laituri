/** Holds a random secret that names the browser's sandbox. It is never the sandbox's public label. */
export const WORKSPACE_COOKIE = "laituri_workspace";

/** "shared" while the browser looks at the shared workspace instead of its sandbox. */
export const VIEW_COOKIE = "laituri_view";

/** The secret outlives an idle sandbox, so a returning visitor silently gets a fresh sandbox under the same cookie. */
export const WORKSPACE_COOKIE_MAX_AGE_S = 30 * 24 * 3600;

const SECRET_BYTES = 32;
const SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Web Crypto only, so the proxy can call it in any runtime. */
export function newWorkspaceSecret(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(SECRET_BYTES)));
}

export function isWorkspaceSecret(value: string | undefined): value is string {
  return value !== undefined && SECRET_PATTERN.test(value);
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
