import { AGENT_TOKEN, jsonRequest } from "../http/env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as voice from "@/app/api/v1/voice/route";
import * as speech from "@/app/api/v1/voice/speech/route";
import * as transcribe from "@/app/api/v1/voice/transcribe/route";
import { MAX_SPEECH_CHARS } from "@/lib/voice/server";
import { WORKSPACE_COOKIE, newWorkspaceSecret } from "@/lib/workspace/cookie";

const AUDIO = new Uint8Array([73, 68, 51, 4]);
const upstream = vi.fn<typeof fetch>();

/** Voice serves a browser in its own sandbox: every call here carries one. */
const SANDBOX = { cookie: `${WORKSPACE_COOKIE}=${newWorkspaceSecret()}` };

const speak = (body: unknown, headers: Record<string, string> = {}) =>
  speech.POST(jsonRequest("/api/v1/voice/speech", { body, headers: { ...SANDBOX, ...headers } }));
const stream = (pathname: string) => speech.GET(jsonRequest(pathname, { headers: SANDBOX }));

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
    expect(await (await voice.GET(jsonRequest("/api/v1/voice"))).json()).toEqual({ tts: "elevenlabs", stt: "elevenlabs" });
    delete process.env.ELEVENLABS_API_KEY;
    expect(await (await voice.GET(jsonRequest("/api/v1/voice"))).json()).toEqual({ tts: "browser", stt: "browser" });
  });
});

describe("GET /api/v1/voice/speech", () => {
  it("streams ElevenLabs audio for an audio element", async () => {
    const response = await stream(`/api/v1/voice/speech?text=${encodeURIComponent("Tilaan menun.")}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(AUDIO);
    const [url, init] = upstream.mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/voice-1\/stream\?/);
    expect(new Headers(init?.headers).get("xi-api-key")).toBe("el-key");
  });

  it("refuses an empty text and works only with a key", async () => {
    expect((await stream("/api/v1/voice/speech")).status).toBe(400);
    delete process.env.ELEVENLABS_API_KEY;
    expect((await stream("/api/v1/voice/speech?text=Hei")).status).toBe(404);
  });
});

describe("POST /api/v1/voice/transcribe", () => {
  const audio = (body: BodyInit, headers: Record<string, string> = {}) =>
    transcribe.POST(new Request("http://localhost:3299/api/v1/voice/transcribe?language=fi-FI", { method: "POST", body, headers: { "content-type": "audio/webm", ...SANDBOX, ...headers } }));

  it("sends the recording to ElevenLabs Scribe with the language and returns the words", async () => {
    upstream.mockResolvedValue(Response.json({ text: " Häät lauantaina, 80 vierasta. " }));
    const response = await audio(new Uint8Array([1, 2, 3]));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: "Häät lauantaina, 80 vierasta." });
    const [url, init] = upstream.mock.calls[0];
    expect(String(url)).toBe("https://api.elevenlabs.io/v1/speech-to-text");
    const form = init?.body as FormData;
    expect(form.get("model_id")).toBe("scribe_v1");
    expect(form.get("language_code")).toBe("fin");
  });

  it("refuses an empty body, an agent token, and answers 404 without a key", async () => {
    expect((await audio(new Uint8Array([]))).status).toBe(400);
    expect((await audio(new Uint8Array([1]), { authorization: `Bearer ${AGENT_TOKEN}` })).status).toBe(403);
    delete process.env.ELEVENLABS_API_KEY;
    expect((await audio(new Uint8Array([1]))).status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });
});
