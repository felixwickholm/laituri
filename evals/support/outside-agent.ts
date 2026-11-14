import type { Order, SearchResponse } from "@/lib/contracts";

/** One curl line of the numbered REST flow in llms.txt; `keep` is a shell variable the line sets from its answer. */
interface FlowStep {
  step: number;
  method: "GET" | "POST";
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  keep?: { name: string; path: string };
}

const PLACEHOLDER = /^<([\w.]+) from step (\d+)>$/;
/** `KEY=$(curl -s -X POST <url> | jq -r '.agentKeys[0].key')`: a curl line whose answer field becomes $KEY. */
const ASSIGNMENT = /^(\w+)=\$\((curl -s .*?) \| jq -r '\.([\w.[\]]+)'\)$/;

/** A jq path such as "agentKeys[0].key" as a dotted path, "agentKeys.0.key". */
function dotted(jqPath: string): string {
  return jqPath.replace(/\[(\d+)\]/g, ".$1");
}

/** The curl lines of the "REST flow" section, in document order, each with the number of its step. */
export function restFlow(llms: string): FlowStep[] {
  const section = llms.split(/^\*\*/m).find((part) => part.startsWith("REST flow"));
  if (!section) throw new Error("llms.txt has no REST flow section.");
  const steps: FlowStep[] = [];
  let step = 0;
  for (const line of section.split("\n")) {
    const numbered = line.match(/^(\d+)\.\s/);
    if (numbered) step = Number(numbered[1]);
    const assignment = line.match(ASSIGNMENT);
    const curl = (assignment?.[2] ?? line).match(/^curl -s (-X POST )?(\S+)(.*)$/);
    if (!curl) continue;
    const headers = Object.fromEntries([...curl[3].matchAll(/-H "([^:"]+):\s*([^"]*)"/g)].map((m) => [m[1], m[2]]));
    const data = curl[3].match(/-d '([^']*)'/)?.[1];
    steps.push({
      step,
      method: data === undefined && !curl[1] ? "GET" : "POST",
      url: curl[2],
      headers,
      body: data === undefined ? undefined : JSON.parse(data),
      ...(assignment ? { keep: { name: assignment[1], path: dotted(assignment[3]) } } : {}),
    });
  }
  if (steps.length === 0) throw new Error("The REST flow in llms.txt shows no curl line.");
  return steps;
}

function field(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], value);
}

/** Replaces "<primary.jws from step 2>" with that field of step 2's answer, anywhere in a body. */
function fill(body: unknown, answers: Map<number, unknown>): unknown {
  if (typeof body === "string") {
    const placeholder = body.match(PLACEHOLDER);
    if (!placeholder) return body;
    const value = field(answers.get(Number(placeholder[2])), placeholder[1]);
    if (typeof value !== "string") throw new Error(`Step ${placeholder[2]} gave no ${placeholder[1]}.`);
    return value;
  }
  if (Array.isArray(body)) return body.map((item) => fill(item, answers));
  if (body && typeof body === "object") return Object.fromEntries(Object.entries(body).map(([key, item]) => [key, fill(item, answers)]));
  return body;
}

/** "Quote for the product you chose": the example lines carry the product the search step chose. */
function withProduct(body: unknown, productId: string | undefined): unknown {
  const lines = (body as { lines?: Record<string, unknown>[] } | undefined)?.lines;
  if (!productId || !Array.isArray(lines)) return body;
  return { ...(body as object), lines: lines.map((line) => ({ ...line, productId })) };
}

/** Headers with each $NAME replaced by the variable an earlier line set. */
function withVariables(headers: Record<string, string>, variables: Map<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name, value.replace(/\$(\w+)/g, (_, variable: string) => {
      const set = variables.get(variable);
      if (set === undefined) throw new Error(`llms.txt uses $${variable} before any line sets it.`);
      return set;
    })]),
  );
}

async function send(step: FlowStep, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const response = await fetch(step.url, { method: step.method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const answer = (await response.json()) as { detail?: string };
  if (!response.ok) throw new Error(`Step ${step.step} (${step.method} ${new URL(step.url).pathname}) answered ${response.status}: ${answer.detail ?? ""}`);
  return answer;
}

function outcome(answer: unknown, chosen: string | undefined): string {
  const value = answer as { hits?: unknown; primary?: { offer: { fulfilment: string } }; jws?: string; status?: string; kind?: string };
  if (value.kind) return `${value.kind} created`;
  if (value.hits) return chosen ?? "no orderable hit";
  if (value.primary) return value.primary.offer.fulfilment;
  return value.status ?? (value.jws ? "jws" : "answered");
}

/**
 * An agent that knows nothing but the text of llms.txt, fetched over HTTP. It runs the numbered REST flow's
 * curl lines in order, with the URLs, headers and bodies written there: first it makes its own sandbox and keeps the key
 * the text names, then it takes the first orderable search hit, as the text says, and fills each "<field from step N>"
 * from step N's answer.
 */
export async function outsideAgent(origin: string): Promise<{ order: Order; steps: string[] }> {
  const llms = await (await fetch(new URL("/llms.txt", origin))).text();
  const answers = new Map<number, unknown>();
  const variables = new Map<string, string>();
  const steps: string[] = [];
  let chosen: string | undefined;
  let last: unknown;
  for (const step of restFlow(llms)) {
    if (new URL(step.url).origin !== new URL(origin).origin) throw new Error(`llms.txt sends step ${step.step} to ${step.url}, not to ${origin}.`);
    last = await send(step, withVariables(step.headers, variables), fill(withProduct(step.body, chosen), answers));
    answers.set(step.step, last);
    if (step.keep) variables.set(step.keep.name, String(field(last, step.keep.path)));
    const hits = (last as Partial<SearchResponse>).hits;
    if (hits) chosen = hits.find((hit) => hit.offerPreview?.orderable)?.product.id;
    steps.push(`${step.method} ${new URL(step.url).pathname} -> ${outcome(last, chosen)}`);
  }
  const order = last as Order;
  if (!order.status) throw new Error("The last step of the REST flow did not answer with an order.");
  return { order, steps };
}
