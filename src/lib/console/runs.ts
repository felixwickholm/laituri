import type { Order } from "@/lib/contracts";
import { ruleName } from "./format/rules";
import type { Activity } from "./types";

export interface RunStep {
  id: string;
  at: string;
  text: string;
  status: Activity["status"];
  tools: Activity[];
}

export interface Attempt {
  n: number;
  action: string;
  /** true stopped, false got through, undefined still running */
  stopped?: boolean;
  reason?: string;
  rule?: string;
  orderId?: string;
  tools: Activity[];
}

export interface RunBlock {
  id: string;
  /** Set when the activity carried an exact run tag; then title is the buyer's request. */
  runId?: string;
  title?: string;
  agent: Activity["agent"];
  startedAt: string;
  endedAt: string;
  kind: "purchase" | "attempts";
  /** The first note that says what the buyer wants, such as "Looking for …". */
  lookingFor?: string;
  label?: string;
  steps: RunStep[];
  attempts: Attempt[];
  orderIds: string[];
  toolCount: number;
  summary?: Activity;
}

const GAP_MS = 30_000;
const LABEL = /^Purchase \d+ of \d+:/;
const LOOKING = /^Looking for /;
const ATTEMPT = /^Attempt (\d+) of (\d+):\s*(.*)$/;
const ATTEMPT_SUMMARY = /^(\d+) of (\d+) attempts/;
const CONNECTED = / connected$/;

function startsBlock(item: Activity, block: RunBlock | undefined, previousAt: number | undefined): boolean {
  if (!block) return true;
  if (item.agent.id !== block.agent.id) return true;
  if (previousAt !== undefined && Date.parse(item.at) - previousAt > GAP_MS) return true;
  if (item.kind !== "note") return false;
  if (LABEL.test(item.title)) return true;
  const attempt = item.title.match(ATTEMPT);
  if (attempt) return attempt[1] === "1";
  if (LOOKING.test(item.title)) return block.kind === "attempts" ? false : block.lookingFor !== undefined || !block.label;
  return false;
}

function newBlock(item: Activity): RunBlock {
  return {
    id: item.id,
    runId: item.run?.id,
    title: item.run?.title,
    agent: item.agent,
    startedAt: item.at,
    endedAt: item.at,
    kind: ATTEMPT.test(item.title) ? "attempts" : "purchase",
    steps: [],
    attempts: [],
    orderIds: [],
    toolCount: 0,
  };
}

function addNote(block: RunBlock, item: Activity): void {
  const attempt = item.title.match(ATTEMPT);
  if (block.kind === "attempts") {
    if (attempt) {
      block.attempts.push({ n: Number(attempt[1]), action: attempt[3], tools: [] });
      return;
    }
    if (ATTEMPT_SUMMARY.test(item.title)) {
      block.summary = item;
      return;
    }
    const current = block.attempts[block.attempts.length - 1];
    if (current && current.stopped === undefined && (item.status === "blocked" || item.status === "error")) {
      current.stopped = item.status === "blocked";
      current.reason = item.title.replace(/^Stopped\.\s*/, "").replace(/^Not stopped:?\s*/, "");
      return;
    }
  }
  if (LABEL.test(item.title)) {
    block.label = item.title.replace(LABEL, "").trim();
    return;
  }
  if (LOOKING.test(item.title) && !block.lookingFor) block.lookingFor = item.title.replace(LOOKING, "").replace(/\.$/, "");
  block.steps.push({ id: item.id, at: item.at, text: item.title, status: item.status, tools: [] });
}

function addTool(block: RunBlock, item: Activity): void {
  block.toolCount += 1;
  const orderId = item.refs?.orderId;
  if (orderId && !block.orderIds.includes(orderId)) block.orderIds.push(orderId);
  const attempt = block.attempts[block.attempts.length - 1];
  if (block.kind === "attempts" && attempt) {
    attempt.tools.push(item);
    if (orderId && item.tool === "place_order") attempt.orderId = orderId;
    return;
  }
  const step = block.steps[block.steps.length - 1];
  if (step) step.tools.push(item);
  else block.steps.push({ id: item.id, at: item.at, text: item.title, status: item.status, tools: [] });
}

/**
 * Groups the flat activity feed into runs: one block per buyer request, steps oldest first,
 * tool calls tucked under the note they follow. Newest run first.
 */
export function buildRuns(activity: Activity[], orders: Order[] = []): RunBlock[] {
  const blocks: RunBlock[] = [];
  let block: RunBlock | undefined;
  let previousAt: number | undefined;
  // Stable sort on time only: notes written in the same millisecond keep the order the server appended them.
  const sorted = [...activity].sort((a, b) => a.at.localeCompare(b.at));
  for (const item of sorted) {
    if (item.kind === "note" && CONNECTED.test(item.title)) continue;
    const owner = item.kind === "note" && item.refs?.orderId ? blocks.find((run) => run.orderIds.includes(item.refs?.orderId as string)) : undefined;
    if (owner && owner !== block) {
      // A person's decision on an earlier order belongs to the run that placed it.
      owner.steps.push({ id: item.id, at: item.at, text: item.title, status: item.status, tools: [] });
      owner.endedAt = item.at;
      continue;
    }
    if (item.run) {
      // Tagged activity groups exactly by run id, whatever order it arrives in.
      const tagged = blocks.find((run) => run.runId === item.run?.id);
      block = tagged ?? newBlock(item);
      if (!tagged) blocks.push(block);
    } else if (block?.runId || startsBlock(item, block, previousAt)) {
      // Untagged activity (outside agents) never joins a tagged run.
      block = newBlock(item);
      blocks.push(block);
    }
    const current = block as RunBlock;
    if (item.kind === "note") addNote(current, item);
    else addTool(current, item);
    current.endedAt = item.at;
    previousAt = Date.parse(item.at);
  }
  const byId = new Map(orders.map((order) => [order.id, order]));
  for (const run of blocks) {
    for (const attempt of run.attempts) {
      const order = attempt.orderId ? byId.get(attempt.orderId) : undefined;
      const block = order?.decision.checks.find((check) => check.status === "block");
      attempt.rule = block ? ruleName(block.rule) : attempt.stopped ? "Only a person can approve" : undefined;
    }
  }
  return blocks.reverse();
}
