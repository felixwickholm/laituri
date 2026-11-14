/** One agent call as /api/v1/activity returns it. `client` is optional: older records do not have it. */
export interface CallRecord {
  id: string;
  at: string;
  agent: { id: string; name: string };
  kind: string;
  tool?: string;
  title: string;
  status: "ok" | "waiting" | "blocked" | "error";
  client?: string;
  run?: { id: string; title: string };
}

/** Agent tool calls made from outside: scripted demo runs are left out. Newest first, at most `limit`. */
export function latestCalls(records: CallRecord[], limit: number): CallRecord[] {
  return records
    .filter((record) => record.kind === "tool" && !record.run)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

/** Merges a poll's records into what is shown, without duplicates. */
export function mergeCalls(shown: CallRecord[], incoming: CallRecord[], limit: number): CallRecord[] {
  const byId = new Map(shown.map((record) => [record.id, record]));
  for (const record of incoming) byId.set(record.id, record);
  return latestCalls([...byId.values()], limit);
}

export function timeAgo(at: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(at)) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}
