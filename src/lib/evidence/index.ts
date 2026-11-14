import { criteria } from "./criteria";
import { FACTS } from "./facts";
import { core, optional, privacy, problems, scenarios } from "./requirements";
import { LINKS, notBuilt, production, simulated } from "./scope";
import type { Evidence, Facts } from "./types";

export type * from "./types";
export { FACTS, suiteLine, testsLine } from "./facts";

export const NAME = "Laituri";
export const PITCH =
  "An open MCP and REST front door that lets a customer's own AI purchasing agent buy from Valio Aimo at a signed fixed price, inside limits a person signed, with a log anyone can verify.";
/** The public demo. The address is set at release; it is the same one the README names. */
export const LIVE_URL = "https://laituri.31-97-126-112.sslip.io";

/** Everything the README, docs, /evidence, /evidence.json and llms.txt say about the project, built from one source. */
export function evidence(facts: Facts = FACTS): Evidence {
  return {
    name: NAME,
    pitch: PITCH,
    live: LIVE_URL,
    licence: "MIT",
    facts,
    criteria: criteria(facts),
    core: core(facts),
    optional: optional(),
    problems: problems(facts),
    scenarios: scenarios(),
    privacy: privacy(),
    simulated: simulated(facts),
    notBuilt: notBuilt(),
    production: production(),
    links: LINKS,
  };
}
