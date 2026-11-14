"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import { ORB_STATE_WORDS, type OrbState } from "@/lib/console/orb-params";
import { RuleId } from "@/lib/contracts";
import { readPalette } from "./palette";
import { OrbRenderer, type FrameInfo } from "./renderer";
import { Seal } from "./Seal";
import { REST_TILT } from "./spin";

export type { OrbState };

export interface AgentOrbProps {
  state: OrbState;
  /** The live order's digits or the audit head hash; the orb's glyphs are read from it. */
  digits?: string;
  rulesPassed?: number;
  rulesTotal?: number;
  /** Microphone level 0..1 while listening. */
  level?: number;
  /** Largest drawn size in CSS pixels; the orb shrinks to fit a narrower parent. */
  size?: number;
  className?: string;
}

function sealTransform({ yaw, pitch, scale }: FrameInfo): string {
  const tiltX = -(pitch - REST_TILT) * 38;
  const tiltY = Math.sin(yaw) * 9;
  return `perspective(900px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
}

/**
 * The agent, drawn: a sphere of dots made of the deal's digits, with the mandate seal at its heart.
 * State drives colour and motion; drag spins it. Pauses off-screen; reduced motion draws one still frame.
 */
export function AgentOrb({ state, digits = "", rulesPassed = 0, rulesTotal = RuleId.options.length, level = 0, size = 440, className }: AgentOrbProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sealRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<OrbRenderer | null>(null);
  const initial = useRef({ state, digits });

  useEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new OrbRenderer(canvas, readPalette(), reduced);
    rendererRef.current = renderer;
    renderer.setState(initial.current.state);
    renderer.setDigits(initial.current.digits);
    renderer.onFrame = (info) => {
      if (sealRef.current) sealRef.current.style.transform = sealTransform(info);
    };

    let onScreen = false;
    const sync = () => {
      if (onScreen && document.visibilityState === "visible") renderer.play();
      else renderer.pause();
    };
    const resize = new ResizeObserver(([entry]) => {
      renderer.resize(Math.round(entry.contentRect.width), window.devicePixelRatio || 1);
      sync();
    });
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    const theme = new MutationObserver(() => renderer.setPalette(readPalette()));
    resize.observe(frame);
    intersection.observe(frame);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    document.addEventListener("visibilitychange", sync);
    void document.fonts?.ready.then(() => renderer.setPalette(readPalette()));

    return () => {
      renderer.pause();
      resize.disconnect();
      intersection.disconnect();
      theme.disconnect();
      document.removeEventListener("visibilitychange", sync);
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => rendererRef.current?.setState(state), [state]);
  useEffect(() => rendererRef.current?.setDigits(digits), [digits]);
  useEffect(() => rendererRef.current?.setLevel(level), [level]);

  function grab(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    rendererRef.current?.spin.grab(event.clientX, event.clientY, event.timeStamp);
  }
  function drag(event: PointerEvent<HTMLDivElement>) {
    rendererRef.current?.spin.drag(event.clientX, event.clientY, event.timeStamp);
  }
  function release() {
    rendererRef.current?.spin.release();
  }

  const passed = Math.min(rulesPassed, rulesTotal);
  const label = `Agent orb. ${ORB_STATE_WORDS[state]}. ${passed} of ${rulesTotal} mandate rules passed.`;

  return (
    <div className={className ? `orb ${className}` : "orb"} data-state={state} style={{ maxWidth: size }}>
      <div
        ref={frameRef}
        className="orb-frame"
        role="img"
        aria-label={label}
        onPointerDown={grab}
        onPointerMove={drag}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <canvas ref={canvasRef} className="orb-canvas" />
        <div ref={sealRef} className="orb-seal">
          <Seal state={state} rulesPassed={passed} rulesTotal={rulesTotal} />
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        {ORB_STATE_WORDS[state]}
      </span>
    </div>
  );
}
