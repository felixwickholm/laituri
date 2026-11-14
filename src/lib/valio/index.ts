import { CachedUpstream } from "./cached";
import { call, configFromEnv, UpstreamError } from "./http";
import { LiveUpstream } from "./live";
import { RecordedUpstream } from "./recorded";
import type { UpstreamClient } from "./types";

export type { UpstreamAvailability, UpstreamClient, UpstreamPrice } from "./types";
export { UpstreamError } from "./http";
export { LiveUpstream } from "./live";
export { UPSTREAM_ID_CAP } from "./budget";
export { measuringUpstream, upstreamUsage, type UpstreamUsage } from "./meter";
export { RecordedUpstream } from "./recorded";
export { normaliseAvailability, normalisePrice } from "./normalise";

export type UpstreamMode = "live" | "recorded";

export interface PingResult {
  ok: boolean;
  mode: UpstreamMode;
  latencyMs?: number;
  error?: string;
}

/** live unless VALIO_MODE=recorded; without an API key the recorded data is the only option. */
export function upstreamMode(): UpstreamMode {
  if (process.env.VALIO_MODE === "recorded") return "recorded";
  return configFromEnv() ? "live" : "recorded";
}

const clients = new Map<UpstreamMode, UpstreamClient>();

export function upstream(): UpstreamClient {
  const mode = upstreamMode();
  let client = clients.get(mode);
  if (!client) {
    const config = configFromEnv();
    client = new CachedUpstream(mode === "live" && config ? new LiveUpstream(config) : new RecordedUpstream());
    clients.set(mode, client);
  }
  return client;
}

/** Health is polled by every open page; one upstream ping per half minute keeps those polls off the API's rate limit. */
const PING_TTL_MS = 30_000;
let lastPing: { at: number; result: Promise<PingResult> } | undefined;

export function ping(): Promise<PingResult> {
  const mode = upstreamMode();
  if (mode === "recorded" || !configFromEnv()) return Promise.resolve({ ok: true, mode: "recorded" });
  if (!lastPing || Date.now() - lastPing.at > PING_TTL_MS) lastPing = { at: Date.now(), result: pingNow(mode) };
  return lastPing.result;
}

async function pingNow(mode: UpstreamMode): Promise<PingResult> {
  const config = configFromEnv();
  if (!config) return { ok: true, mode: "recorded" };
  const started = performance.now();
  try {
    await call(config, "/ping");
    return { ok: true, mode, latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    const message = error instanceof UpstreamError ? error.message : "The wholesaler API could not be reached.";
    return { ok: false, mode, error: message };
  }
}
