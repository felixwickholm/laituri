import { refuseAgents } from "@/lib/http/agent";
import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { voiceSettings } from "@/lib/voice/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Tells the console which voice to speak with. */
export const GET = route(async (request) => {
  refuseAgents(request.headers);
  return json(voiceSettings());
});
