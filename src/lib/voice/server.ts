import { GatewayError } from "@/lib/gateway/errors";
import type { VoiceSettings } from "./types";

export const MAX_SPEECH_CHARS = 600;
/** "George", one of the ElevenLabs default voices. */
export const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const MODEL_ID = "eleven_flash_v2_5";
const API_ROOT = "https://api.elevenlabs.io/v1/text-to-speech";
const TIMEOUT_MS = 20_000;

type Env = Record<string, string | undefined>;

export class VoiceNotConfiguredError extends GatewayError {
  constructor() {
    super("Spoken answers from ElevenLabs are not set up on this server. Use the browser's voice.", 404, "voice_not_configured");
  }
}

export class VoiceUnavailableError extends GatewayError {
  constructor(detail: string) {
    super(detail, 502, "voice_unavailable");
  }
}

function apiKey(env: Env): string | undefined {
  return env.ELEVENLABS_API_KEY?.trim() || undefined;
}

export function voiceSettings(env: Env = process.env): VoiceSettings {
  return { tts: apiKey(env) ? "elevenlabs" : "browser" };
}

/** Throws unless the server can speak through ElevenLabs. */
export function requireVoice(env: Env = process.env): void {
  if (!apiKey(env)) throw new VoiceNotConfiguredError();
}

/** Turns text into MP3 audio with ElevenLabs. The key never leaves the server. */
export async function synthesizeSpeech(text: string, env: Env = process.env): Promise<ArrayBuffer> {
  const key = apiKey(env);
  if (!key) throw new VoiceNotConfiguredError();
  const voice = env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: MODEL_ID }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new VoiceUnavailableError("ElevenLabs could not be reached.");
  }
  if (!response.ok) throw new VoiceUnavailableError(`ElevenLabs answered with status ${response.status}.`);
  return response.arrayBuffer();
}
