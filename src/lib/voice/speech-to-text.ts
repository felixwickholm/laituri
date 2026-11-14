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
