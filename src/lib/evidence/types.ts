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
  /** What the wholesaler's price and availability APIs are asked, measured on a 20-line weekly order in recorded mode. */
  upstream: {
    searchCap: number;
    quoteLineCap: number;
    basketLines: number;
    basketCalls: number;
    basketProductsAsked: number;
    /** Products in the full product files the challenge provides, which search runs on locally. */
    catalogueSize: number;
  };
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

/** A simulated or assumed part, with a few words for the README's short list. */
export interface Simulated extends Assumption {
  brief: string;
}

export interface ProductionStep {
  step: string;
  why: string;
  /** What already exists in the repo that this step builds on, if anything. */
  where: string[];
}

/** An attack or failure the design defends against, with the code and the eval cases that show the defence holds. */
export interface Threat {
  threat: string;
  defence: string;
  where: string[];
  check: Check[];
}

/** A question a reviewer asks, answered from the same source as the rest of the evidence. Shown on /paper and in its FAQPage data. */
export interface Question {
  question: string;
  answer: string;
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
  simulated: Simulated[];
  notBuilt: Assumption[];
  production: ProductionStep[];
  threats: Threat[];
  questions: Question[];
  links: { label: string; href: string; note: string }[];
}
