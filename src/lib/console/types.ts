import type { AuditEntry, Mandate, Order, WorkspaceInfo } from "@/lib/contracts";
import type { Activity } from "@/lib/store/types";

export type { Activity, WorkspaceInfo };

/** Shapes the console reads from the REST routes that the contracts do not cover. */
export interface Health {
  status: string;
  mode: "live" | "recorded";
  catalog?: { ready: boolean; size: number };
  /** Which engine runs a typed request: the scripted agent, or a live model. */
  agent?: { engine: "claude" | "gemini" | "scripted"; model?: string };
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

/** "passcode": the role's passcode signs in. "open": a development server signs anyone in. "closed": nobody can. */
export type SignInMode = "passcode" | "open" | "closed";

/** The two people a browser can act as: the buyer's approver and the wholesaler's operator. */
export type SessionRole = "approver" | "operator";

export type WorkspaceKind = WorkspaceInfo["kind"];

/** The wholesaler side of the session: who may suspend and resume agents. */
export interface OperatorSession {
  signedIn: boolean;
  operator?: { id: string; name: string };
  demo?: boolean;
  mode: SignInMode;
}

/**
 * Both sides of this browser's session in its current workspace. `demo` marks an approver session opened with
 * one-click demo access; `demoAccess` says the server offers it here (only in the visitor's own sandbox).
 */
export interface ConsoleSession {
  signedIn: boolean;
  approver?: { id: string; name: string };
  buyer?: { id: string; name: string };
  mode: SignInMode;
  demo?: boolean;
  demoAccess: boolean;
  workspace: WorkspaceKind;
  operator: OperatorSession;
  /** After a sign-in: which role it signed in. */
  role?: SessionRole;
}

/** What a person signs in with: a passcode, or the server's demo access, as the approver unless the operator is named. */
export type SignInCredentials = ({ passcode: string } | { demo: true }) & { role?: SessionRole };

export type Scenario = "milk" | "over-limit" | "break-mandate" | "two-kitchens" | "weekly";

export interface DemoRun {
  id: string;
  status: "running" | "done" | "failed";
  request: string;
  scenario?: Scenario;
  summary?: string;
  /** Set when the run has finished: one result per purchase, with the order it placed. */
  results?: { orderId?: string }[];
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
  /** Every read answered 401 credential_required: nothing here may be read without a sign-in. */
  locked?: boolean;
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
