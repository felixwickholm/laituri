import { z } from "zod";
import { refuseAgents } from "@/lib/http/agent";
import { readSession, signIn, signOutCookie } from "@/lib/http/console-session";
import { readBody, route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SignInBody = z.object({ passcode: z.string().max(200).optional() });

export const GET = route(async (request) => json(await readSession(request.headers)));

export const POST = route(async (request) => {
  refuseAgents(request.headers);
  const body = await readBody(request, SignInBody);
  const { cookie, session } = await signIn(body.passcode);
  return json(session, { headers: { "set-cookie": cookie } });
});

export const DELETE = route(async () => json({ signedIn: false }, { headers: { "set-cookie": signOutCookie() } }));
