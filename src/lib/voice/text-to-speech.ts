import { DEFAULT_LANGUAGE, type TextToSpeech, type TtsEngine, type VoiceSettings } from "./types";

const VOICE_PATH = "/api/v1/voice";
const SPEECH_PATH = "/api/v1/voice/speech";

/** The browser's own speech synthesis, when this browser has it. */
export function browserTextToSpeech(): TextToSpeech | undefined {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  const synthesis = window.speechSynthesis;
  return {
    engine: "browser",
    speak(text, options = {}) {
      return new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = options.language ?? DEFAULT_LANGUAGE;
        // A voice of the language itself, when the system has one: a Finnish sentence in an English voice is hard to follow.
        const voice = synthesis.getVoices().find((entry) => entry.lang.replace("_", "-").toLowerCase() === utterance.lang.toLowerCase());
        if (voice) utterance.voice = voice;
        utterance.onend = () => resolve();
        utterance.onerror = (event) => {
          if (event.error === "canceled" || event.error === "interrupted") resolve();
          else reject(new Error(`Speech failed: ${event.error}.`));
        };
        synthesis.speak(utterance);
      });
    },
    cancel: () => synthesis.cancel(),
  };
}

/** ElevenLabs voices through the server route, which keeps the key. Plays the returned MP3 in an audio element. */
export function elevenLabsTextToSpeech(fetchAudio: typeof fetch = fetch): TextToSpeech {
  let playing: { audio: HTMLAudioElement; done: () => void } | undefined;
  const stop = () => {
    if (!playing) return;
    playing.audio.pause();
    playing.done();
  };
  return {
    engine: "elevenlabs",
    async speak(text) {
      stop();
      const response = await fetchAudio(SPEECH_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error(`Speech failed with status ${response.status}.`);
      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      await new Promise<void>((resolve, reject) => {
        const finish = (error?: Error) => {
          URL.revokeObjectURL(url);
          if (playing?.audio === audio) playing = undefined;
          if (error) reject(error);
          else resolve();
        };
        playing = { audio, done: () => finish() };
        audio.onended = () => finish();
        audio.onerror = () => finish(new Error("The audio could not be played."));
        audio.play().catch(() => finish(new Error("The audio could not be played.")));
      });
    },
    cancel: stop,
  };
}

/**
 * ElevenLabs voices streamed through GET /api/v1/voice/speech: the audio element plays as the first chunks arrive,
 * so a reply starts within a moment instead of after the whole file. The key stays on the server.
 */
export function streamingElevenLabsTextToSpeech(createAudio: (src: string) => HTMLAudioElement = (src) => new Audio(src)): TextToSpeech {
  let playing: { audio: HTMLAudioElement; done: () => void } | undefined;
  const stop = () => {
    if (!playing) return;
    playing.audio.pause();
    playing.done();
  };
  return {
    engine: "elevenlabs",
    speak(text) {
      stop();
      const audio = createAudio(`${SPEECH_PATH}?text=${encodeURIComponent(text.slice(0, 600))}`);
      return new Promise<void>((resolve, reject) => {
        const finish = (error?: Error) => {
          if (playing?.audio === audio) playing = undefined;
          if (error) reject(error);
          else resolve();
        };
        playing = { audio, done: () => finish() };
        audio.onended = () => finish();
        audio.onerror = () => finish(new Error("The audio could not be played."));
        audio.play().catch(() => finish(new Error("The audio could not be played.")));
      });
    },
    cancel: stop,
  };
}

/** ElevenLabs when the server has a key; else the browser's voices; "none" when neither can speak. */
export function pickTtsEngine(settings: VoiceSettings, browserCanSpeak: boolean): TtsEngine | "none" {
  if (settings.tts === "elevenlabs") return "elevenlabs";
  return browserCanSpeak ? "browser" : "none";
}

/** Asks the server which voice to use. Any failure means the browser's own voices. */
export async function fetchVoiceSettings(fetchSettings: typeof fetch = fetch): Promise<VoiceSettings> {
  try {
    const response = await fetchSettings(VOICE_PATH, { headers: { accept: "application/json" } });
    const body = (await response.json()) as Partial<VoiceSettings>;
    const tts = response.ok && body.tts === "elevenlabs" ? "elevenlabs" : "browser";
    return body.stt ? { tts, stt: response.ok && body.stt === "elevenlabs" ? "elevenlabs" : "browser" } : { tts };
  } catch {
    return { tts: "browser" };
  }
}

/** The voice the UI should speak with, or undefined when this browser cannot speak at all. */
export function createTextToSpeech(settings: VoiceSettings): TextToSpeech | undefined {
  const browser = browserTextToSpeech();
  const engine = pickTtsEngine(settings, browser !== undefined);
  if (engine === "elevenlabs") return elevenLabsTextToSpeech();
  return engine === "browser" ? browser : undefined;
}
