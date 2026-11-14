import { AGENT_TOKEN, jsonRequest } from "../http/env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as voice from "@/app/api/v1/voice/route";
import * as speech from "@/app/api/v1/voice/speech/route";
import { MAX_SPEECH_CHARS } from "@/lib/voice/server";

const AUDIO = new Uint8Array([73, 68, 51, 4]);
const upstream = vi.fn<typeof fetch>();

const speak = (body: unknown, headers: Record<string, string> = {}) =>
  speech.POST(jsonRequest("/api/v1/voice/speech", { body, headers }));

beforeEach(() => {
  upstream.mockReset();
  upstream.mockResolvedValue(new Response(AUDIO, { headers: { "content-type": "audio/mpeg" } }));
  vi.stubGlobal("fetch", upstream);
  process.env.ELEVENLABS_API_KEY = "el-key";
  process.env.ELEVENLABS_VOICE_ID = "voice-1";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.ELEVENLABS_VOICE_ID;
});

describe("POST /api/v1/voice/speech", () => {
  it("returns ElevenLabs audio and keeps the key on the server", async () => {
    const response = await speak({ text: "Done. It was inside your mandate." });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(AUDIO);

    const [url, init] = upstream.mock.calls[0];
    expect(String(url)).toBe("https://api.elevenlabs.io/v1/text-to-speech/voice-1?output_format=mp3_44100_128");
    expect(new Headers(init?.headers).get("xi-api-key")).toBe("el-key");
    expect(JSON.parse(String(init?.body))).toMatchObject({ text: "Done. It was inside your mandate." });
  });

  it("answers voice_not_configured without a key", async () => {
    delete process.env.ELEVENLABS_API_KEY;
    const response = await speak({ text: "Hello." });
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    expect((await response.json()).code).toBe("voice_not_configured");
    expect(upstream).not.toHaveBeenCalled();
  });

  it("refuses text over the length cap", async () => {
    const response = await speak({ text: "a".repeat(MAX_SPEECH_CHARS + 1) });
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_request");
    expect(upstream).not.toHaveBeenCalled();
  });

  it("refuses an agent token", async () => {
    const response = await speak({ text: "Hello." }, { authorization: `Bearer ${AGENT_TOKEN}` });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("agent_not_allowed");
    expect(upstream).not.toHaveBeenCalled();
  });

  it("reports an ElevenLabs failure as a bad gateway", async () => {
    upstream.mockResolvedValue(new Response("{}", { status: 401 }));
    const response = await speak({ text: "Hello." });
    expect(response.status).toBe(502);
    expect((await response.json()).code).toBe("voice_unavailable");
  });
});

describe("GET /api/v1/voice", () => {
  it("names the voice the console should use", async () => {
    expect(await (await voice.GET(jsonRequest("/api/v1/voice"))).json()).toEqual({ tts: "elevenlabs" });
    delete process.env.ELEVENLABS_API_KEY;
    expect(await (await voice.GET(jsonRequest("/api/v1/voice"))).json()).toEqual({ tts: "browser" });
  });
});
