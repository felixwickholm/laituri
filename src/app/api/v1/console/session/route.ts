import { z } from "zod";
import { refuseAgents } from "@/lib/http/agent";
import { readSession, signIn, signInDemo, signOutCookie } from "@/lib/http/console-session";
import { readBody, route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { PRIMARY_BUYER_ID } from "@/lib/mandate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** { passcode, buyer } signs in a buyer's approver. { demo: true } is one-click demo access as the primary buyer's approver. */
const SignInBody = z
  .object({
    passcode: z.string().max(200).optional(),
    buyer: z.string().max(100).optional(),
    demo: z.boolean().optional(),
  })
  .refine((body) => !body.demo || body.buyer === undefined || body.buyer === PRIMARY_BUYER_ID, {
    message: "Demo access signs in as the primary buyer's approver only.",
    path: ["buyer"],
  });

export const GET = route(async (request) => json(await readSession(request.headers)));

export const POST = route(async (request) => {
  refuseAgents(request.headers);
  const body = await readBody(request, SignInBody);
  const { cookie, session } = body.demo ? await signInDemo() : await signIn(body.passcode, body.buyer);
  return json(session, { headers: { "set-cookie": cookie } });
});

export const DELETE = route(async () => json({ signedIn: false }, { headers: { "set-cookie": signOutCookie() } }));
