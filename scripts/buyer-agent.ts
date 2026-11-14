/**
 * The buyer's purchasing agent as an outside process: it buys through the public REST interface only.
 * Usage: npx tsx scripts/buyer-agent.ts "1,000 litres of lactose-free milk by Monday" [--url http://localhost:3210]
 */
import { existsSync } from "node:fs";
import { httpTransport } from "../src/lib/agent/http-transport";
import { runPurchase } from "../src/lib/agent/purchase";

if (existsSync(".env")) process.loadEnvFile(".env");

const TOKEN = "demo-agent-token";

function parseArgs(argv: string[]): { request?: string; url: string } {
  let url = process.env.LAITURI_URL ?? "http://localhost:3210";
  const words: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url") url = argv[++i] ?? url;
    else if (argv[i].startsWith("--url=")) url = argv[i].slice("--url=".length);
    else words.push(argv[i]);
  }
  return { request: words.join(" ").trim() || undefined, url };
}

async function main(): Promise<number> {
  const { request, url } = parseArgs(process.argv.slice(2));
  if (!request) {
    console.error('Usage: npx tsx scripts/buyer-agent.ts "<what to buy>" [--url http://localhost:3210]');
    return 2;
  }
  console.log(`Buying through ${url}`);
  const result = await runPurchase(request, httpTransport(url, TOKEN), {
    note: (text, status = "ok") => console.log(`  ${status.padEnd(7)} ${text}`),
    pause: async () => undefined,
  });
  console.log(`\nResult: ${result.status}`);
  console.log(result.summary);
  if (result.orderId) console.log(`Order: ${url.replace(/\/+$/, "")}/api/v1/orders/${result.orderId}`);
  return result.status === "failed" ? 1 : 0;
}

main().then((code) => process.exit(code));
