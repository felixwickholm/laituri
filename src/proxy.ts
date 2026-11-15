import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy, isStaticPage, newNonce } from "@/lib/http/csp";
import { WORKSPACE_COOKIE, WORKSPACE_COOKIE_MAX_AGE_S, isWorkspaceSecret, newWorkspaceSecret, withCookie } from "@/lib/workspace/cookie";

/**
 * Two jobs on every page load. It sets the page's Content-Security-Policy with a fresh nonce, which Next.js reads from
 * the request and puts on its scripts. And it gives a browser its sandbox secret on its first page load, before any of
 * the page's API calls go out, so they all carry one secret and land in one sandbox. The secret is signed with the
 * server's cookie key; a value the server did not issue (an old cookie, a made-up one) is replaced by a fresh one. The
 * secret is only issued here; the sandbox is made on first use.
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = isStaticPage(request.nextUrl.pathname) ? undefined : newNonce();
  const policy = contentSecurityPolicy({ nonce, dev: process.env.NODE_ENV !== "production" });
  let headers = new Headers(request.headers);
  headers.set("content-security-policy", policy);
  if (nonce) headers.set("x-nonce", nonce);

  const issued = isWorkspaceSecret(request.cookies.get(WORKSPACE_COOKIE)?.value);
  const secret = issued ? undefined : newWorkspaceSecret();
  // The page being rendered sees the new secret too, as every later request will.
  if (secret) headers = withCookie(headers, `${WORKSPACE_COOKIE}=${secret}`);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("content-security-policy", policy);
  if (secret) {
    response.cookies.set(WORKSPACE_COOKIE, secret, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: WORKSPACE_COOKIE_MAX_AGE_S,
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
}

/** Pages only: agents, API calls, documents for machines and static files never get a sandbox cookie from here. */
export const config = {
  matcher: ["/((?!api/|mcp|_next/|\\.well-known/|llms\\.txt|evidence\\.json|submission\\.json|brief|icon\\.svg|favicon\\.ico).*)"],
};
