import { workspaceState } from "@/lib/workspace/context";
import type { LogHead } from "./verify";

/** A sandbox inherits the template's head, so its copied log is checked for completeness from the start. */
const knownHeadOf = workspaceState<{ head?: LogHead }>("audit.head", () => ({}), { inherit: true });

/** Records the newest entry written in this workspace, kept apart from the stored log. */
export function rememberHead(head: LogHead): void {
  knownHeadOf().head = head;
}

export function knownHead(): LogHead | undefined {
  return knownHeadOf().head;
}

/** Called when the log is cleared on purpose. */
export function forgetHead(): void {
  knownHeadOf().head = undefined;
}
