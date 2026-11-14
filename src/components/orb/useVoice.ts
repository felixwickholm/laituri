"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { micLevel, smoothLevel } from "@/lib/console/orb-level";
import { webSpeechToText } from "@/lib/voice/speech-to-text";
import { createTextToSpeech, fetchVoiceSettings } from "@/lib/voice/text-to-speech";
import type { ListenError, ListenSession, TextToSpeech } from "@/lib/voice/types";
import { toast } from "../ui/toast";

export const VOICE_UNSUPPORTED = "Voice is not supported in this browser. Typing always works.";

const LISTEN_ERRORS: Record<ListenError, string | undefined> = {
  "not-allowed": "The microphone is blocked. Allow it in the browser, or type instead.",
  "no-speech": "Heard nothing. Try again, or type instead.",
  network: "Speech recognition needs a network connection. Type instead.",
  aborted: undefined,
  failed: "Voice input stopped. Type instead.",
};

const noSubscription = () => () => undefined;
const canListen = () => webSpeechToText().status === "supported";

interface VoiceHandlers {
  /** The words heard so far, while the person speaks. */
  onTranscript(text: string): void;
  /** The finished request, once the person stops speaking. */
  onRequest(text: string): void;
}

/** Follows the microphone's loudness, smoothed, until stopped. Resolves to a stop function. */
async function meterMicrophone(onLevel: (level: number) => void): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audio = new AudioContext();
  const analyser = audio.createAnalyser();
  analyser.fftSize = 512;
  audio.createMediaStreamSource(stream).connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);
  let level = 0;
  let last = performance.now();
  let frame = requestAnimationFrame(function read(now) {
    analyser.getByteTimeDomainData(samples);
    level = smoothLevel(level, micLevel(samples), now - last);
    last = now;
    onLevel(level);
    frame = requestAnimationFrame(read);
  });
  return () => {
    cancelAnimationFrame(frame);
    for (const track of stream.getTracks()) track.stop();
    void audio.close();
    onLevel(0);
  };
}

/**
 * Voice for the agent panel: listen (with a live transcript and the mic level for the orb) and speak results.
 * Typing stays available whatever happens here.
 */
export function useVoice({ onTranscript, onRequest }: VoiceHandlers) {
  const supported = useSyncExternalStore(noSubscription, canListen, () => true);
  const [listening, setListening] = useState(false);
  const [level, setLevel] = useState(0);
  const session = useRef<ListenSession | null>(null);
  const stopMeter = useRef<(() => void) | null>(null);
  const voice = useRef<Promise<TextToSpeech | undefined> | null>(null);
  const handlers = useRef({ onTranscript, onRequest });

  useEffect(() => {
    handlers.current = { onTranscript, onRequest };
  }, [onTranscript, onRequest]);

  useEffect(
    () => () => {
      session.current?.abort();
      stopMeter.current?.();
      void voice.current?.then((tts) => tts?.cancel());
    },
    [],
  );

  function start(): void {
    const support = webSpeechToText();
    if (support.status !== "supported") {
      toast(VOICE_UNSUPPORTED, "danger");
      return;
    }
    let heard = "";
    setListening(true);
    session.current = support.speechToText.listen({
      onInterim: (text) => handlers.current.onTranscript(text),
      onFinal: (text) => {
        heard = text;
        handlers.current.onTranscript(text);
      },
      onError: (error) => {
        const message = LISTEN_ERRORS[error];
        if (message) toast(message, "danger");
      },
      onEnd: () => {
        session.current = null;
        stopMeter.current?.();
        stopMeter.current = null;
        setListening(false);
        if (heard.trim()) handlers.current.onRequest(heard.trim());
      },
    });
    meterMicrophone(setLevel)
      .then((stop) => {
        if (session.current) stopMeter.current = stop;
        else stop();
      })
      .catch(() => setLevel(0));
  }

  function stop(): void {
    session.current?.stop();
  }

  /** Reads a result aloud with ElevenLabs when the server has it, else the browser's own voice. */
  async function speak(text: string): Promise<void> {
    voice.current ??= fetchVoiceSettings().then(createTextToSpeech);
    const tts = await voice.current;
    if (!tts) return;
    try {
      await tts.speak(text);
    } catch {
      toast("The answer could not be read aloud.", "danger");
    }
  }

  return { supported, listening, level, start, stop, speak };
}
