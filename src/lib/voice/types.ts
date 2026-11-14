export type VoiceLanguage = "en-US" | "fi-FI";

export const DEFAULT_LANGUAGE: VoiceLanguage = "en-US";

/** Where spoken answers come from: ElevenLabs through the server, or the browser's own voices. */
export type TtsEngine = "elevenlabs" | "browser";

/** What GET /api/v1/voice returns. */
export interface VoiceSettings {
  tts: TtsEngine;
  /** Where speech is heard: ElevenLabs through the server, or the browser's own recognition. */
  stt?: TtsEngine;
}

export type ListenError = "not-allowed" | "no-speech" | "network" | "aborted" | "failed";

export interface ListenHandlers {
  /** The words so far, while the person is still speaking. */
  onInterim?(text: string): void;
  /** The finished utterance. */
  onFinal(text: string): void;
  onError?(error: ListenError): void;
  /** Listening stopped, after a final result, an error or stop(). */
  onEnd?(): void;
}

export interface ListenSession {
  /** Stops listening and keeps what was heard. */
  stop(): void;
  /** Stops listening and drops what was heard. */
  abort(): void;
}

export interface SpeechToText {
  listen(handlers: ListenHandlers, options?: { language?: VoiceLanguage }): ListenSession;
}

export type SpeechToTextSupport =
  | { status: "supported"; speechToText: SpeechToText }
  | { status: "unsupported"; reason: string };

export interface TextToSpeech {
  engine: TtsEngine;
  /** Resolves when the speech has finished or was cancelled. */
  speak(text: string, options?: { language?: VoiceLanguage }): Promise<void>;
  cancel(): void;
}
