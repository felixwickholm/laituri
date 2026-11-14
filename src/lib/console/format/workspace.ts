import type { WorkspaceInfo } from "@/lib/contracts";
import { roleSession } from "../session";
import type { ConsoleSession, Health, SessionRole } from "../types";
import { shortName } from "./rules";

export interface WorkspaceLine {
  /** "Sandbox Q7MX" or "Shared workspace". */
  label: string;
  /** Who sees what happens here. */
  privacy: string;
  /** "58 min left", only when the workspace expires. */
  timeLeft?: string;
  shared: boolean;
}

/** To the nearest minute, then hours and minutes; never below one minute while the workspace still exists. */
export function timeLeft(expiresAt: string, now: number): string | undefined {
  const ms = Date.parse(expiresAt) - now;
  if (Number.isNaN(ms)) return undefined;
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min left`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min left` : `${hours} h left`;
}

/** What the workspace indicator says about the browser's current workspace. */
export function workspaceLine(info: WorkspaceInfo, now: number): WorkspaceLine {
  if (info.kind === "shared") {
    return { label: "Shared workspace", privacy: "seen by every visitor, read-only here", shared: true };
  }
  const left = info.expiresAt ? timeLeft(info.expiresAt, now) : undefined;
  return { label: info.label, privacy: "private to this browser", ...(left ? { timeLeft: left } : {}), shared: false };
}

/** One row of "What is live and what is simulated". */
export interface DemoFact {
  label: string;
  value: string;
}

/** What is real in this demo: prices and stock come from Valio Aimo, orders do not ship, older rows are demo data. */
export function demoFacts(mode: Health["mode"] | undefined): DemoFact[] {
  return [
    { label: "Prices and stock", value: mode === "recorded" ? "Recorded from Valio Aimo" : "Live from Valio Aimo" },
    { label: "Orders", value: "Simulated, never shipped" },
    { label: "Before today", value: "Demo history" },
  ];
}

export interface EngineChip {
  /** "AI model: Gemini", or "Built-in agent" when no live model is connected. */
  label: string;
  /** The model id, for a technical details row only. */
  model?: string;
}

const MODEL_NAMES = { gemini: "Gemini", claude: "Claude" } as const;

/** Which engine answers a typed request, in words for a buyer; undefined until health has arrived. */
export function engineChip(health: Health | undefined): EngineChip | undefined {
  const agent = health?.agent;
  if (!agent) return undefined;
  if (agent.engine === "scripted") return { label: "Built-in agent" };
  return { label: `AI model: ${MODEL_NAMES[agent.engine]}`, ...(agent.model ? { model: agent.model } : {}) };
}

/** "Maria Lind" becomes "ML"; at most two letters. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** The operator's name as the server gives it carries "(demo access)"; the role line says that instead. */
export const OPERATOR_NAME = "Valio Aimo operator";

export interface Account {
  signedIn: boolean;
  name: string;
  /** The role title: the screens name the role, the signed record names how the person signed in. */
  role: string;
  initials: string;
}

/** Who acts for this side: the buyer's approver, or the Valio Aimo operator. */
export function accountFor(session: ConsoleSession | undefined, role: SessionRole, approverName: string): Account {
  const side = roleSession(session, role);
  const name = role === "operator" ? OPERATOR_NAME : shortName(side.name ?? approverName);
  const title = role === "operator" ? "Operator" : "Approver";
  return { signedIn: side.signedIn, name, role: title, initials: initials(name) };
}

/**
 * The shared workspace is read only with a passcode session: without one its records answer 401, so the app shows one
 * calm state instead of the page. A demo session left over from the sandbox does not count. Until the workspace is
 * known, nothing is locked.
 */
export function sharedLocked(info: Pick<WorkspaceInfo, "kind"> | undefined, session: ConsoleSession | undefined): boolean {
  if (info?.kind !== "shared") return false;
  const passcode = (role: SessionRole) => {
    const side = roleSession(session, role);
    return side.signedIn && !side.demo;
  };
  return !passcode("approver") && !passcode("operator");
}
