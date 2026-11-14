import type { AuditEntry, Mandate, Order } from "@/lib/contracts";
import type { Activity } from "@/lib/store/types";

export type { Activity };

/** Shapes the console reads from the REST routes that the contracts do not cover. */
export interface Health {
  status: string;
  mode: "live" | "recorded";
  catalog?: { ready: boolean; size: number };
}

export interface PublicKey {
  kid?: string;
  kty?: string;
  role?: "supplier" | "buyer" | "approver";
  [field: string]: unknown;
}

export interface Jwks {
  keys: PublicKey[];
}

export interface SignedMandate {
  jws: string;
  mandate: Mandate;
}

/**
 * The approver session. "open" means this server signs anyone in without a passcode.
 * `demo` marks a session opened with one-click demo access; `demoAccess` says the server offers it.
 */
export interface ConsoleSession {
  signedIn: boolean;
  approver?: { id: string; name: string };
  mode?: "passcode" | "open";
  demo?: boolean;
  demoAccess?: boolean;
}

/** What a person signs in with: a passcode, or the server's demo access. */
export type SignInCredentials = { passcode: string } | { demo: true };

export type Scenario = "milk" | "over-limit" | "break-mandate" | "two-kitchens";

export interface DemoRun {
  id: string;
  status: "running" | "done" | "failed";
  request: string;
  scenario?: Scenario;
  summary?: string;
}

export type ChainState =
  | { state: "empty" }
  | { state: "checking"; entries: number }
  | { state: "verified"; entries: number; head?: string }
  | { state: "broken"; entries: number; brokenAt: number; reason: string };

/** Every slice the console renders, kept in one snapshot so screens stay consistent. */
export interface ConsoleSnapshot {
  ready: boolean;
  online: boolean;
  activity: Activity[];
  orders: Order[];
  audit: AuditEntry[];
  chain: ChainState;
  jwks?: Jwks;
  health?: Health;
  mandate?: SignedMandate;
  run?: DemoRun;
  session?: ConsoleSession;
}
