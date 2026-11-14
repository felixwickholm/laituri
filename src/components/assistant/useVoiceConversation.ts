"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  browserTextToSpeech,
  fetchVoiceSettings,
  recordedSpeechToText,
  streamingElevenLabsTextToSpeech,
  webSpeechToText,
  type ListenSession,
  type SpeechToText,
  type TextToSpeech,
  type VoiceLanguage,
  type VoiceSettings,
} from "@/lib/voice";

/** off: the conversation is closed. The other three are what the kitchen sees and hears. */
export type VoiceState = "off" | "listening" | "thinking" | "speaking";

interface Options {
  language: VoiceLanguage;
  /** Sends what was heard as a turn; resolves with the reply to speak, or nothing to stop. */
  onHeard(words: string): Promise<string | undefined>;
}

function pickListener(settings: VoiceSettings): SpeechToText | undefined {
  if (settings.stt === "elevenlabs") {
    const recorded = recordedSpeechToText();
    if (recorded.status === "supported") return recorded.speechToText;
  }
  const web = webSpeechToText();
  return web.status === "supported" ? web.speechToText : undefined;
}

/**
 * A spoken conversation: listen, send, speak the reply, listen again, until the kitchen taps to stop. Tapping while
 * the assistant speaks interrupts it and listens at once. ElevenLabs hears and speaks when the server has a key;
 * otherwise the browser's own recognition and voices.
 */
export function useVoiceConversation({ language, onHeard }: Options) {
  const [state, setState] = useState<VoiceState>("off");
  const [interim, setInterim] = useState("");
  const [problem, setProblem] = useState<string>();
  const [supported, setSupported] = useState<boolean>();
  const listener = useRef<SpeechToText | undefined>(undefined);
  const voice = useRef<TextToSpeech | undefined>(undefined);
  const fallbackVoice = useRef<TextToSpeech | undefined>(undefined);
  const session = useRef<ListenSession | undefined>(undefined);
  const active = useRef(false);
  const heardRef = useRef(onHeard);
  const languageRef = useRef(language);
  /** listen() starts the next turn from its own callback, through this ref. */
  const again = useRef<() => void>(() => undefined);

  useEffect(() => {
    heardRef.current = onHeard;
    languageRef.current = language;
  });

  useEffect(() => {
    let alive = true;
    void fetchVoiceSettings().then((settings) => {
      if (!alive) return;
      listener.current = pickListener(settings);
      fallbackVoice.current = browserTextToSpeech();
      voice.current = settings.tts === "elevenlabs" ? streamingElevenLabsTextToSpeech() : fallbackVoice.current;
      setSupported(listener.current !== undefined);
    });
    return () => {
      alive = false;
      active.current = false;
      session.current?.abort();
      voice.current?.cancel();
    };
  }, []);

  const close = useCallback(() => {
    active.current = false;
    session.current?.abort();
    session.current = undefined;
    voice.current?.cancel();
    fallbackVoice.current?.cancel();
    setInterim("");
    setState("off");
  }, []);

  const speak = useCallback(async (text: string) => {
    const options = { language: languageRef.current };
    try {
      await voice.current?.speak(text, options);
    } catch {
      // ElevenLabs failed: say it with the browser's voice instead of staying silent.
      if (voice.current !== fallbackVoice.current) await fallbackVoice.current?.speak(text, options).catch(() => undefined);
    }
  }, []);

  const listen = useCallback(() => {
    const stt = listener.current;
    if (!stt || !active.current) return;
    setState("listening");
    setInterim("");
    let finalWords = "";
    session.current = stt.listen(
      {
        onInterim: setInterim,
        onFinal: (words) => {
          finalWords = words;
        },
        onError: (error) => {
          if (error === "not-allowed") setProblem("Allow the microphone to talk.");
          else if (error === "network") setProblem("Speech could not be heard. Type instead.");
        },
        onEnd: () => {
          session.current = undefined;
          if (!active.current) return;
          if (!finalWords) {
            close();
            return;
          }
          setInterim(finalWords);
          setState("thinking");
          void heardRef.current(finalWords).then(async (reply) => {
            if (!active.current) return;
            if (!reply) {
              close();
              return;
            }
            setState("speaking");
            await speak(reply);
            if (active.current) again.current();
          });
        },
      },
      { language: languageRef.current },
    );
  }, [close, speak]);

  useEffect(() => {
    again.current = listen;
  }, [listen]);

  /** The one mic button: start, interrupt the reply, or stop. */
  const tap = useCallback(() => {
    setProblem(undefined);
    if (state === "off") {
      if (!listener.current) {
        setProblem("This browser cannot hear speech. Try Chrome, Edge or Safari, or type.");
        return;
      }
      voice.current?.cancel();
      active.current = true;
      listen();
      return;
    }
    if (state === "speaking") {
      voice.current?.cancel();
      fallbackVoice.current?.cancel();
      return;
    }
    close();
  }, [close, listen, state]);

  return { state, interim, problem, supported, tap, close, speak };
}
