import type { LogHead } from "./verify";

const globalHead = globalThis as typeof globalThis & { __laituriAuditHead?: LogHead };

/** Records the newest entry written by this process, kept apart from the stored log. */
export function rememberHead(head: LogHead): void {
  globalHead.__laituriAuditHead = head;
}

export function knownHead(): LogHead | undefined {
  return globalHead.__laituriAuditHead;
}

/** Called when the log is cleared on purpose. */
export function forgetHead(): void {
  globalHead.__laituriAuditHead = undefined;
}
