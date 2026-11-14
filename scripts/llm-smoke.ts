/**
 * One live purchase with the model-driven buyer agent, through the in-process gateway, to check a model key works.
 * Uses Claude when ANTHROPIC_API_KEY is set, else Gemini when GEMINI_API_KEY is set (LAITURI_AGENT_ENGINE overrides).
 * Usage: npx tsx scripts/llm-smoke.ts ["what to buy"]
 */
import { existsSync } from "node:fs";
import { gatewayTransport } from "../src/lib/agent/gateway-transport";
import { runModelPurchase } from "../src/lib/agent/llm/loop";
import { providerFor, selectEngine } from "../src/lib/agent/llm/engine";
import { DEMO_AGENT } from "../src/lib/agent/types";

if (existsSync(".env")) process.loadEnvFile(".env");

const DEFAULT_REQUEST = "1,000 litres of lactose-free milk by Monday";

async function main(): Promise<number> {
  const request = process.argv.slice(2).join(" ").trim() || DEFAULT_REQUEST;
  const choice = selectEngine();
  const provider = providerFor(choice);
  if (!provider) {
    console.log(`No model key: set ANTHROPIC_API_KEY or GEMINI_API_KEY to run the model agent.${choice.unavailable ? ` ${choice.unavailable}` : ""}`);
    return 0;
  }
  console.log(`Engine: ${provider.engine} (${provider.model})`);
  console.log(`Request: ${request}\n`);
  const hooks = {
    note: (text: string, status = "ok") => console.log(`  ${status.padEnd(7)} ${text}`),
    pause: async () => undefined,
  };
  const result = await runModelPurchase(request, gatewayTransport(DEMO_AGENT), hooks, provider);
  console.log(`\nResult: ${result.status}`);
  console.log(result.summary);
  return result.status === "failed" ? 1 : 0;
}

main().then((code) => process.exit(code));
