"use client";

import { ArrowUp, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { consoleStore } from "@/lib/console/store";
import type { DemoRun, Scenario } from "@/lib/console/types";
import { tamperWithLog } from "../proof/ProofTools";
import { toast } from "../ui/toast";

const SCENES: { id: Scenario; n: number; label: string; short: string }[] = [
  { id: "milk", n: 1, label: "Milk by Monday", short: "Milk" },
  { id: "over-limit", n: 2, label: "Over the limit", short: "Limit" },
  { id: "break-mandate", n: 3, label: "Break the mandate", short: "Break" },
];

interface DockProps {
  run?: DemoRun;
  fresh: boolean;
}

/** The floating capsule: three scenes, a free request and reset. */
export function Dock({ run, fresh }: DockProps) {
  const [request, setRequest] = useState("");
  const [starting, setStarting] = useState<Scenario | "free" | null>(null);
  const tamperAfter = useRef<string | null>(null);
  const running = run?.status === "running" || starting !== null;
  const active = starting && starting !== "free" ? starting : run?.scenario ?? null;

  useEffect(() => {
    if (!run || run.status === "running") return;
    if (run.status === "failed") toast(run.summary ?? "The agent stopped before it finished.", "danger");
    if (tamperAfter.current === run.id) {
      tamperAfter.current = null;
      void tamperWithLog();
    }
  }, [run]);

  async function start(body: { scenario?: Scenario; request?: string }, key: Scenario | "free") {
    setStarting(key);
    try {
      await consoleStore.startRun(body);
      if (body.scenario === "break-mandate") tamperAfter.current = consoleStore.getSnapshot().run?.id ?? null;
    } catch (error) {
      toast(error instanceof Error ? error.message : "The scene could not start.", "danger");
    } finally {
      setStarting(null);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = request.trim();
    if (!text || running) return;
    void start({ request: text }, "free").then(() => setRequest(""));
  }

  async function reset() {
    try {
      await consoleStore.reset();
      tamperAfter.current = null;
      toast("Reset. The log is empty and verified again.", "neutral");
    } catch {
      toast("Reset did not reach the server.", "danger");
    }
  }

  const status = running ? (run?.request ? `Agent is working on: ${run.request}` : "Agent is working…") : undefined;

  return (
    <>
      {status ? (
        <p className="dock-status" aria-live="polite">
          {status}
        </p>
      ) : null}
      <div className="dock glass" data-guide="dock" role="toolbar" aria-label="Demo scenes">
        <span className="dock-progress" data-on={running} aria-hidden="true" />
        <div className="scenes">
          {SCENES.map((scene) => (
            <button
              key={scene.id}
              type="button"
              className="scene"
              disabled={running}
              data-active={active === scene.id}
              data-running={active === scene.id && running}
              aria-label={`Scene ${scene.n}: ${scene.label}`}
              data-hint={fresh && scene.n === 1 && !running}
              onClick={() => start({ scenario: scene.id }, scene.id)}
            >
              <span className="n">{scene.n}</span>
              <span className="long">{scene.label}</span>
              <span className="short" aria-hidden="true">
                {scene.short}
              </span>
            </button>
          ))}
        </div>
        <span className="divider" aria-hidden="true" />
        <form className="ask" onSubmit={submit}>
          <label className="sr-only" htmlFor="ask-agent">
            Ask the agent to buy something
          </label>
          <input
            id="ask-agent"
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            placeholder="Ask the agent to buy something…"
            autoComplete="off"
            enterKeyHint="send"
          />
          <button type="submit" className="icon-btn send" disabled={running || request.trim() === ""} aria-label="Send to the agent">
            <ArrowUp aria-hidden="true" />
          </button>
        </form>
        <button type="button" className="btn btn-quiet reset" onClick={reset} disabled={starting !== null}>
          <RotateCcw aria-hidden="true" />
          Reset
        </button>
      </div>
    </>
  );
}
