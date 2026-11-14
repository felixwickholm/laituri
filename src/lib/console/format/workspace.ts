import type { WorkspaceInfo } from "@/lib/contracts";

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
