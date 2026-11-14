import { z } from "zod";
import { refuseAgents } from "@/lib/http/agent";
import { readSession, signIn, signInDemo } from "@/lib/http/console-session";
import { readBody, route } from "@/lib/http/handler";
import { signInOperator, signInOperatorDemo } from "@/lib/http/operator-session";
import { json } from "@/lib/http/respond";
import { clearedSessionCookie, type SessionRole } from "@/lib/http/session-token";
import { PRIMARY_BUYER_ID } from "@/lib/mandate";
import { withCookie } from "@/lib/workspace/cookie";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * { passcode, buyer } signs in a buyer's approver; { passcode, role: "operator" } the wholesaler's operator.
 * { demo: true } (with role "operator" for the wholesaler side) is one-click demo access, in the visitor's sandbox only.
 */
const SignInBody = z
  .object({
    passcode: z.string().max(200).optional(),
    buyer: z.string().max(100).optional(),
    demo: z.boolean().optional(),
    role: z.enum(["approver", "operator"]).default("approver"),
  })
  .refine((body) => body.role === "approver" || body.buyer === undefined, {
    message: "An operator works for the wholesaler, not for one buyer.",
    path: ["buyer"],
  })
  .refine((body) => !body.demo || body.buyer === undefined || body.buyer === PRIMARY_BUYER_ID, {
    message: "Demo access signs in as the primary buyer's approver only.",
    path: ["buyer"],
  });

const SignOutRole = z.enum(["approver", "operator"]).optional();

export const GET = route(async (request) => json(await readSession(request.headers)), { openInSharedView: true });

export const POST = route(async (request) => {
  refuseAgents(request.headers);
  const body = await readBody(request, SignInBody);
  const cookie =
    body.role === "operator"
      ? await (body.demo ? signInOperatorDemo() : signInOperator(body.passcode))
      : await (body.demo ? signInDemo() : signIn(body.passcode, body.buyer));
  // The answer describes the browser as it will be on its next request, with the new session in place.
  const session = await readSession(withCookie(request.headers, cookie));
  return json({ ...session, role: body.role }, { headers: { "set-cookie": cookie } });
}, { openInSharedView: true });

/** Signs out one role (?role=approver or ?role=operator), or both. */
export const DELETE = route(async (request) => {
  const role = SignOutRole.parse(new URL(request.url).searchParams.get("role") ?? undefined);
  const roles: SessionRole[] = role ? [role] : ["approver", "operator"];
  const headers = new Headers();
  for (const each of roles) headers.append("set-cookie", clearedSessionCookie(each));
  return json({ signedIn: false }, { headers });
}, { openInSharedView: true });
