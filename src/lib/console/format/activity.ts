import type { Activity } from "../types";
import { eur, parseEur } from "./money";
import { plainSentence } from "./sentence";

export type Tone = "neutral" | "waiting" | "danger";

export interface ActivityView {
  title: string;
  detail?: string;
  result: string;
  tone: Tone;
}

const STATUS_WORD: Record<Activity["status"], string> = {
  ok: "",
  waiting: "Waiting",
  blocked: "Blocked",
  error: "Failed",
};

/** Turns one recorded call into the row the agent pane shows: sentence, detail and a short result. */
export function activityView(activity: Activity): ActivityView {
  const tone: Tone = activity.status === "waiting" ? "waiting" : activity.status === "ok" ? "neutral" : "danger";
  const amount = parseEur(activity.detail);
  let result = STATUS_WORD[activity.status];
  if (activity.status === "ok" && amount !== undefined) result = eur(amount);
  return {
    title: plainSentence(activity.title),
    detail: activity.detail ? plainSentence(activity.detail) : undefined,
    result,
    tone,
  };
}

/** "sha256:1b090c55…c084a58" style truncation: first 8 and last 6 characters. */
export function shortHash(value: string | undefined): string {
  if (!value) return "–";
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

/** The newest agent seen in the stream, for the pane header. */
export function connectedAgent(activity: Activity[]): Activity["agent"] | undefined {
  return activity.length ? activity[activity.length - 1].agent : undefined;
}
