import { appendAudit } from "@/lib/audit";
import { ValidationError, hasStatus } from "@/lib/gateway/errors";
import { PRIMARY_BUYER_ID, buyerIds, currentMandate, isKnownBuyer } from "@/lib/mandate";
import type { Decider } from "@/lib/orders/types";
import { currentWorkspace, type WorkspaceKind } from "@/lib/workspace/context";
import { ANONYMOUS_AGENT, DEMO_AGENT_NAME, ForbiddenError, bearerToken } from "./agent";
import { operatorSession, type OperatorSession } from "./operator-session";
import { DEMO_VIA, checkPasscode, demoAccessHere, requireDemoAccess, signInMode, type SignInMode } from "./sign-in";
import { sessionClaims, sessionCookie, type SessionRole } from "./session-token";

interface Party {
  id: string;
  name: string;
}

/** A buyer whose approver can sign in to the console. */
export interface BuyerChoice extends Party {
  approver: Party;
}

/** A signed-in approver: the person, the one buyer they decide for, and how they signed in. */
export interface ApproverSession {
  approver: Party;
  buyer: Party;
  demo: boolean;
}

export interface ConsoleSession {
  /** Whether a buyer's approver is signed in. */
  signedIn: boolean;
  approver?: Party;
  buyer?: Party;
  /** True when the approver session came from one-click demo access instead of the passcode. */
  demo?: boolean;
  /** How an approver signs in here (LAITURI_APPROVER_PASSCODE). */
  mode: SignInMode;
  /** Whether { "demo": true } signs a visitor in without the passcode: only in the visitor's own sandbox. */
  demoAccess: boolean;
  buyers: BuyerChoice[];
  /** The workspace the session belongs to. */
  workspace: WorkspaceKind;
  /** The wholesaler operator side of the same browser. */
  operator: OperatorSession;
  /** After a sign-in: which role it signed in. */
  role?: SessionRole;
}

/** The audit-relevant part of a session: whose orders it decides, and whether the entry must name demo access. */
export function deciderOf(session: ApproverSession): Decider {
  return { buyerId: session.buyer.id, ...(session.demo ? { via: DEMO_VIA } : {}) };
}

async function buyerChoices(): Promise<BuyerChoice[]> {
  const mandates = await Promise.all(buyerIds().map((id) => currentMandate(id)));
  return mandates.map(({ mandate }) => ({ id: mandate.buyer.id, name: mandate.buyer.name, approver: mandate.approval.approver }));
}

/** The signed-in approver of this workspace, if any. */
export async function approverSession(headers: Headers): Promise<ApproverSession | undefined> {
  const claims = await sessionClaims(headers, "approver");
  if (!claims?.buyer || !isKnownBuyer(claims.buyer)) return undefined;
  const { mandate } = await currentMandate(claims.buyer);
  return {
    approver: { id: claims.sub, name: claims.name },
    buyer: { id: mandate.buyer.id, name: mandate.buyer.name },
    demo: claims.demo === true,
  };
}

/** Both sides of the browser's console session in the current workspace. */
export async function readSession(headers: Headers): Promise<ConsoleSession> {
  const [approver, operator, buyers] = await Promise.all([approverSession(headers), operatorSession(headers), buyerChoices()]);
  const base = {
    mode: signInMode("approver"),
    demoAccess: demoAccessHere(),
    buyers,
    workspace: currentWorkspace().kind,
    operator,
  };
  return approver ? { signedIn: true, ...approver, ...base } : { signedIn: false, ...base };
}

/** The Set-Cookie value for one buyer's approver. */
async function approverCookie(buyerId: string, demo: boolean): Promise<string> {
  const { mandate } = await currentMandate(buyerId);
  const approver = mandate.approval.approver;
  return sessionCookie({ role: "approver", sub: approver.id, name: approver.name, buyer: mandate.buyer.id, ...(demo ? { demo: true as const } : {}) });
}

/** Signs in the approver of one buyer, the primary buyer when none is named. */
export async function signIn(given: string | undefined, buyerId: string = PRIMARY_BUYER_ID): Promise<string> {
  checkPasscode("approver", given);
  if (!isKnownBuyer(buyerId)) throw new ValidationError(`No buyer with the id ${buyerId} is known.`);
  return approverCookie(buyerId, false);
}

/** One-click demo access in a sandbox: the primary buyer's approver, no passcode, and every action it takes says so. */
export async function signInDemo(): Promise<string> {
  requireDemoAccess();
  return approverCookie(PRIMARY_BUYER_ID, true);
}

/** What a person may do in the console and an agent may not. */
const HUMAN_ACTIONS = {
  approve: "approve or reject orders",
  mandate: "change the mandate",
  reset: "reset the demo",
  tamper: "alter the audit log",
} as const;
export type HumanAction = keyof typeof HUMAN_ACTIONS;

/**
 * The guard for routes: like requireApprover, and every refusal goes into the audit log,
 * so an attempt to act as the approver leaves a trace.
 */
export async function guardApprover(
  headers: Headers,
  action: HumanAction,
  refs: { orderId?: string } = {},
): Promise<ApproverSession> {
  try {
    return await requireApprover(headers, action);
  } catch (error) {
    if (hasStatus(error, 403)) {
      const byAgent = bearerToken(headers) !== undefined;
      const who = byAgent ? DEMO_AGENT_NAME : "A caller without an approver session";
      await appendAudit({
        actor: { type: "agent", id: byAgent ? "agent:token" : ANONYMOUS_AGENT.id, name: byAgent ? DEMO_AGENT_NAME : ANONYMOUS_AGENT.name },
        event: "access.refused",
        summary: `${who} tried to ${HUMAN_ACTIONS[action]}. Refused: only the signed-in approver can.`,
        refs,
        data: { action, code: error.code },
      });
    }
    throw error;
  }
}

/** Human-only actions need a signed approver session for this workspace. A header or an agent token is never enough. */
export async function requireApprover(headers: Headers, action: HumanAction = "approve"): Promise<ApproverSession> {
  if (bearerToken(headers)) {
    throw new ForbiddenError(`Agents cannot ${HUMAN_ACTIONS[action]}.`, "agent_not_allowed");
  }
  const session = await approverSession(headers);
  if (!session) throw new ForbiddenError("Sign in as the approver to do this.", "approver_sign_in_required");
  return session;
}
