/** Shapes of the evidence that README, docs, /evidence, /evidence.json and llms.txt are built from. */

/** Numbers measured by `npm run evidence`. Nothing in this shape is typed by hand. */
export interface Facts {
  tests: { files: number; total: number; passed: number; failed: number };
  evals: {
    mode: string;
    generatedAt: string;
    passed: number;
    total: number;
    suites: { id: string; name: string; passed: number; total: number; bar: string; met: boolean }[];
    caseIds: string[];
  };
  mandateRules: number;
  ruleIds: string[];
  mcpTools: number;
  toolNames: string[];
  restOperations: number;
  restPaths: number;
  discoveryDocuments: number;
  signingKeys: string[];
  demoBuyers: number;
  buyerNames: string[];
  seededRequests: number;
  seededOrders: number;
  recordedProducts: number;
}

/**
 * How a reviewer checks a claim. `command` must be an npm script or a runnable file in the repo, `url` a route of the
 * app, `eval` a case id in evals/report.json, `test` a test file.
 */
export type Check =
  | { kind: "command"; value: string }
  | { kind: "url"; value: string }
  | { kind: "eval"; value: string }
  | { kind: "test"; value: string };

export type Status = "covered" | "partly" | "not built";

export interface Criterion {
  /** Exact name as published in the challenge brief. */
  name: string;
  weight: number;
  claim: string;
  built: string[];
  where: string[];
  check: Check[];
  /** One line each, computed from the facts. */
  measured: string[];
  /** What the claim does not cover. Never empty. */
  limit: string;
}

export interface Requirement {
  /** The brief's words. */
  quote: string;
  status: Status;
  answer: string;
  where: string[];
  check: Check[];
}

export interface Scenario {
  name: string;
  quote: string;
  status: Status;
  note: string;
  where: string[];
  check: Check[];
}

export interface Assumption {
  topic: string;
  text: string;
  where: string[];
}

export interface ProductionStep {
  step: string;
  why: string;
  /** What already exists in the repo that this step builds on, if anything. */
  where: string[];
}

export interface Evidence {
  name: string;
  pitch: string;
  live: string;
  licence: string;
  facts: Facts;
  criteria: Criterion[];
  core: Requirement[];
  optional: Requirement[];
  problems: Requirement[];
  scenarios: Scenario[];
  privacy: Requirement[];
  simulated: Assumption[];
  notBuilt: Assumption[];
  production: ProductionStep[];
  links: { label: string; href: string; note: string }[];
}
