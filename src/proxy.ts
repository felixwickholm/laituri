import { NextResponse, type NextRequest } from "next/server";
import { WORKSPACE_COOKIE, WORKSPACE_COOKIE_MAX_AGE_S, isWorkspaceSecret, newWorkspaceSecret, withCookie } from "@/lib/workspace/cookie";

/**
 * Gives a browser its sandbox secret on its first page load, before any of the page's API calls go out, so they all
 * carry one secret and land in one sandbox. The secret is only issued here; the sandbox is made on first use.
 */
export function proxy(request: NextRequest): NextResponse {
  if (isWorkspaceSecret(request.cookies.get(WORKSPACE_COOKIE)?.value)) return NextResponse.next();
  const secret = newWorkspaceSecret();
  // The page being rendered sees the secret too, as every later request will.
  const headers = withCookie(request.headers, `${WORKSPACE_COOKIE}=${secret}`);
  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(WORKSPACE_COOKIE, secret, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: WORKSPACE_COOKIE_MAX_AGE_S,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

/** Pages only: agents, API calls, documents for machines and static files never get a sandbox cookie from here. */
export const config = {
  matcher: ["/((?!api/|mcp|_next/|\\.well-known/|llms\\.txt|evidence\\.json|icon\\.svg|favicon\\.ico).*)"],
};
