import { describe, expect, it, vi } from "vitest";
import { fetchVoiceSettings, pickTtsEngine, webSpeechToText, type ListenHandlers } from "@/lib/voice";
import type { RecognitionConstructor } from "@/lib/voice/speech-to-text";

/** A stand-in for the browser's recognition object that the test drives by hand. */
class FakeRecognition {
  static last: FakeRecognition | undefined;
  lang = "";
  interimResults = false;
  continuous = true;
  maxAlternatives = 0;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  constructor() {
    FakeRecognition.last = this;
  }
}

const Recognition = FakeRecognition as unknown as RecognitionConstructor;

describe("webSpeechToText", () => {
  it("is unsupported on the server and in browsers without the API", () => {
    expect(webSpeechToText()).toEqual({ status: "unsupported", reason: "Speech recognition runs only in the browser." });
    expect(webSpeechToText({})).toMatchObject({ status: "unsupported" });
  });

  it("uses the standard constructor or the webkit one", () => {
    expect(webSpeechToText({ SpeechRecognition: Recognition }).status).toBe("supported");
    expect(webSpeechToText({ webkitSpeechRecognition: Recognition }).status).toBe("supported");
  });

  it("listens in the chosen language and reports interim and final words", () => {
    const support = webSpeechToText({ webkitSpeechRecognition: Recognition });
    if (support.status !== "supported") throw new Error("expected support");
    const handlers: ListenHandlers = { onInterim: vi.fn(), onFinal: vi.fn(), onError: vi.fn() };
    const session = support.speechToText.listen(handlers, { language: "fi-FI" });
    const recognition = FakeRecognition.last!;

    expect(recognition).toMatchObject({ lang: "fi-FI", interimResults: true, continuous: false });
    expect(recognition.start).toHaveBeenCalled();
    recognition.onresult?.({ results: [{ isFinal: false, 0: { transcript: "tuhat litraa" } }] });
    recognition.onresult?.({ results: [{ isFinal: true, 0: { transcript: "tuhat litraa maitoa" } }] });
    recognition.onerror?.({ error: "service-not-allowed" });
    session.stop();

    expect(handlers.onInterim).toHaveBeenCalledWith("tuhat litraa");
    expect(handlers.onFinal).toHaveBeenCalledWith("tuhat litraa maitoa");
    expect(handlers.onError).toHaveBeenCalledWith("not-allowed");
    expect(recognition.stop).toHaveBeenCalled();
  });

  it("listens in English by default", () => {
    const support = webSpeechToText({ SpeechRecognition: Recognition });
    if (support.status !== "supported") throw new Error("expected support");
    support.speechToText.listen({ onFinal: vi.fn() });
    expect(FakeRecognition.last?.lang).toBe("en-US");
  });
});

describe("text-to-speech selection", () => {
  it("prefers ElevenLabs, then the browser, else none", () => {
    expect(pickTtsEngine({ tts: "elevenlabs" }, false)).toBe("elevenlabs");
    expect(pickTtsEngine({ tts: "browser" }, true)).toBe("browser");
    expect(pickTtsEngine({ tts: "browser" }, false)).toBe("none");
  });

  it("reads the server's choice and falls back to the browser on failure", async () => {
    const answer = (body: unknown, status = 200) => vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }));
    expect(await fetchVoiceSettings(answer({ tts: "elevenlabs" }))).toEqual({ tts: "elevenlabs" });
    expect(await fetchVoiceSettings(answer({ code: "agent_not_allowed" }, 403))).toEqual({ tts: "browser" });
    expect(await fetchVoiceSettings(vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")))).toEqual({ tts: "browser" });
  });
});
