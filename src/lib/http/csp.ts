/**
 * The Content-Security-Policy of a page. Scripts run only from this origin and only when they carry the request's nonce
 * (Next.js puts it on its own scripts, the layout on the theme script); 'strict-dynamic' lets those load the page's
 * chunks. A page prerendered at build time has no request and so no nonce: it gets 'unsafe-inline' for scripts instead.
 * Styles allow inline: React and the animation library write style attributes. The tour frames the app's own pages, so
 * framing is allowed from this origin only.
 */
export function contentSecurityPolicy(options: { nonce?: string; dev: boolean }): string {
  const scripts = options.nonce ? [`'nonce-${options.nonce}'`, "'strict-dynamic'"] : ["'unsafe-inline'"];
  const directives = [
    "default-src 'self'",
    `script-src 'self' ${scripts.join(" ")}${options.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    `connect-src 'self'${options.dev ? " ws: wss:" : ""}`,
    "worker-src 'self' blob:",
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(options.dev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

/** Pages prerendered at build time (export const dynamic = "force-static"): no per-request nonce reaches them. */
export const STATIC_PAGES = ["/paper"];

export function isStaticPage(pathname: string): boolean {
  return STATIC_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));
}

/** A fresh nonce per page load: 16 random bytes, base64. Web Crypto, so any runtime can call it. */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
