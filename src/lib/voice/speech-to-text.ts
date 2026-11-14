import { DEFAULT_LANGUAGE, type ListenError, type SpeechToText, type SpeechToTextSupport } from "./types";

/** The part of the Web Speech API recognition object this adapter uses. TypeScript's DOM types do not include it. */
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface RecognitionResult {
  readonly isFinal: boolean;
  readonly [index: number]: { readonly transcript: string };
}

interface RecognitionResultEvent {
  readonly results: ArrayLike<RecognitionResult>;
}

export type RecognitionConstructor = new () => Recognition;

/** Where the constructor lives: the standard name, or the prefixed one Chrome and Safari use. */
export interface RecognitionScope {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
}

function browserScope(): RecognitionScope | undefined {
  return typeof window === "undefined" ? undefined : (window as unknown as RecognitionScope);
}

const ERRORS: Record<string, ListenError> = {
  "not-allowed": "not-allowed",
  "service-not-allowed": "not-allowed",
  "no-speech": "no-speech",
  network: "network",
  aborted: "aborted",
};

function transcripts(results: ArrayLike<RecognitionResult>): { final: string; interim: string } {
  let final = "";
  let interim = "";
  for (const result of Array.from(results)) {
    if (result.isFinal) final += result[0].transcript;
    else interim += result[0].transcript;
  }
  return { final: final.trim(), interim: interim.trim() };
}

function adapter(Constructor: RecognitionConstructor): SpeechToText {
  return {
    listen(handlers, options = {}) {
      const recognition = new Constructor();
      recognition.lang = options.language ?? DEFAULT_LANGUAGE;
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const { final, interim } = transcripts(event.results);
        if (interim) handlers.onInterim?.(`${final} ${interim}`.trim());
        else if (final) handlers.onFinal(final);
      };
      recognition.onerror = (event) => handlers.onError?.(ERRORS[event.error] ?? "failed");
      recognition.onend = () => handlers.onEnd?.();
      recognition.start();
      return { stop: () => recognition.stop(), abort: () => recognition.abort() };
    },
  };
}

/** Speech recognition through the browser's Web Speech API, or why it cannot run here. */
export function webSpeechToText(scope: RecognitionScope | undefined = browserScope()): SpeechToTextSupport {
  if (!scope) return { status: "unsupported", reason: "Speech recognition runs only in the browser." };
  const Constructor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  if (!Constructor) return { status: "unsupported", reason: "This browser has no speech recognition. Try Chrome, Edge or Safari." };
  return { status: "supported", speechToText: adapter(Constructor) };
}

const TRANSCRIBE_PATH = "/api/v1/voice/transcribe";
/** Quiet this long after speech ends the turn. */
const SILENCE_MS = 1_300;
/** Nothing said at all within this time ends listening. */
const NO_SPEECH_MS = 7_000;
const MAX_TURN_MS = 30_000;
/** Loudness (RMS of the waveform, 0..1) above which the microphone hears speech. */
const SPEECH_LEVEL = 0.035;

/**
 * Speech recognition through ElevenLabs: the microphone is recorded in the browser, the turn ends on a short silence
 * (or stop()), and the audio goes to the server, which keeps the key. Undefined where the browser cannot record.
 */
export function recordedSpeechToText(fetchText: typeof fetch = fetch): SpeechToTextSupport {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { status: "unsupported", reason: "This browser cannot record the microphone." };
  }
  return {
    status: "supported",
    speechToText: {
      listen(handlers, options = {}) {
        let cancelled = false;
        let finished = false;
        let recorder: MediaRecorder | undefined;
        let stream: MediaStream | undefined;
        let context: AudioContext | undefined;
        let timer: ReturnType<typeof setInterval> | undefined;
        const chunks: Blob[] = [];

        const cleanUp = () => {
          if (timer) clearInterval(timer);
          stream?.getTracks().forEach((track) => track.stop());
          void context?.close().catch(() => undefined);
        };
        const end = () => {
          if (finished) return;
          finished = true;
          cleanUp();
          handlers.onEnd?.();
        };
        const stopRecording = () => {
          if (recorder && recorder.state !== "inactive") recorder.stop();
          else end();
        };

        void (async () => {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          } catch {
            handlers.onError?.("not-allowed");
            end();
            return;
          }
          if (cancelled) {
            end();
            return;
          }
          recorder = new MediaRecorder(stream);
          recorder.ondataavailable = (event) => {
            if (event.data.size) chunks.push(event.data);
          };
          let heard = false;
          recorder.onstop = async () => {
            cleanUp();
            if (cancelled || !heard) {
              if (!cancelled) handlers.onError?.("no-speech");
              end();
              return;
            }
            handlers.onInterim?.("…");
            try {
              const language = encodeURIComponent(options.language ?? DEFAULT_LANGUAGE);
              const response = await fetchText(`${TRANSCRIBE_PATH}?language=${language}`, {
                method: "POST",
                headers: { "content-type": recorder?.mimeType || "audio/webm" },
                body: new Blob(chunks, { type: recorder?.mimeType || "audio/webm" }),
              });
              const body = (await response.json().catch(() => ({}))) as { text?: unknown };
              const text = response.ok && typeof body.text === "string" ? body.text.trim() : "";
              if (text) handlers.onFinal(text);
              else handlers.onError?.(response.ok ? "no-speech" : "network");
            } catch {
              handlers.onError?.("network");
            }
            end();
          };
          recorder.start(250);

          context = new AudioContext();
          const analyser = context.createAnalyser();
          analyser.fftSize = 1024;
          context.createMediaStreamSource(stream).connect(analyser);
          const samples = new Float32Array(analyser.fftSize);
          const started = Date.now();
          let lastSound = started;
          timer = setInterval(() => {
            analyser.getFloatTimeDomainData(samples);
            const level = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
            const at = Date.now();
            if (level > SPEECH_LEVEL) {
              heard = true;
              lastSound = at;
            }
            if ((heard && at - lastSound > SILENCE_MS) || (!heard && at - started > NO_SPEECH_MS) || at - started > MAX_TURN_MS) stopRecording();
          }, 100);
        })();

        return {
          stop: stopRecording,
          abort: () => {
            cancelled = true;
            stopRecording();
          },
        };
      },
    },
  };
}
