import { refuseAgents } from "@/lib/http/agent";
import { readBody, route } from "@/lib/http/handler";
import { SpeechRequest } from "@/lib/openapi/schemas";
import { requireVoice, synthesizeSpeech } from "@/lib/voice/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Reads a short text aloud with ElevenLabs and returns MP3 audio. */
export const POST = route(async (request) => {
  refuseAgents(request.headers);
  requireVoice();
  const { text } = await readBody(request, SpeechRequest);
  const audio = await synthesizeSpeech(text);
  return new Response(audio, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
});
