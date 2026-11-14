import { ValidationError } from "@/lib/gateway/errors";
import { readBody, route } from "@/lib/http/handler";
import { requireVoiceCaller } from "@/lib/http/voice-access";
import { SpeechRequest } from "@/lib/openapi/schemas";
import { requireVoice, streamSpeech, synthesizeSpeech } from "@/lib/voice/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Reads a short text aloud with ElevenLabs and returns MP3 audio. */
export const POST = route(async (request) => {
  await requireVoiceCaller(request);
  requireVoice();
  const { text } = await readBody(request, SpeechRequest);
  const audio = await synthesizeSpeech(text);
  return new Response(audio, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
});

/** The same as a stream, for an audio element's src: playback starts with the first chunk. */
export const GET = route(async (request) => {
  await requireVoiceCaller(request);
  requireVoice();
  const parsed = SpeechRequest.safeParse({ text: new URL(request.url).searchParams.get("text") ?? "" });
  if (!parsed.success) throw new ValidationError("Give the text to read as ?text=, at most 600 characters.");
  const audio = await streamSpeech(parsed.data.text);
  return new Response(audio, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
});
