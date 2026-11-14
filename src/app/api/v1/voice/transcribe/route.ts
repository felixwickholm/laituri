import { ValidationError } from "@/lib/gateway/errors";
import { readCappedBytes } from "@/lib/http/body";
import { route } from "@/lib/http/handler";
import { requireVoiceCaller } from "@/lib/http/voice-access";
import { json } from "@/lib/http/respond";
import { MAX_AUDIO_BYTES, requireVoice, transcribeSpeech } from "@/lib/voice/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Speech to text with ElevenLabs: the recorded audio as the body, ?language=fi-FI or en-US. Answers { text }. */
export const POST = route(async (request) => {
  await requireVoiceCaller(request);
  requireVoice();
  const bytes = await readCappedBytes(request, MAX_AUDIO_BYTES);
  if (bytes.byteLength === 0) throw new ValidationError("Send the recorded audio as the request body.");
  const audio = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: request.headers.get("content-type") ?? "application/octet-stream" });
  const text = await transcribeSpeech(audio, new URL(request.url).searchParams.get("language") ?? undefined);
  return json({ text });
});
