import { createHash, timingSafeEqual } from "node:crypto";
import { appendAudit } from "@/lib/audit";
import { now } from "@/lib/clock";
import { ValidationError } from "@/lib/gateway/errors";
import { PRIMARY_BUYER_ID, buyerIds, currentMandate, isKnownBuyer } from "@/lib/mandate";
import type { Decider } from "@/lib/orders/types";
import { trust } from "@/lib/trust";
import { ANONYMOUS_AGENT, DEMO_AGENT_NAME, ForbiddenError, bearerToken } from "./agent";

export const SESSION_COOKIE = "laituri_approver";
const SESSION_HOURS = 12;
const SESSION_TYP = "console+jwt";

/** What a signed audit entry says about an action taken in a demo access session. */
export const DEMO_VIA = "demo access";

interface Party {
  id: string;
  name: string;
}

interface SessionClaims {
  sub: string;
  name: string;
  /** The buyer whose approver signed in. */
  buyer: string;
  demo?: true;
  exp: number;
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
  signedIn: boolean;
  approver?: Party;
  buyer?: Party;
  /** True when the session came from one-click demo access instead of the passcode. */
  demo?: boolean;
  /** "passcode": the approver must know LAITURI_APPROVER_PASSCODE. "open": anyone may sign in; local demos only. */
  mode: "passcode" | "open";
  /** Whether { "demo": true } signs a visitor in as the primary buyer's approver without the passcode. */
  demoAccess: boolean;
  buyers: BuyerChoice[];
}

function passcode(): string | undefined {
  return process.env.LAITURI_APPROVER_PASSCODE?.trim() || undefined;
}

export function sessionMode(): ConsoleSession["mode"] {
  return passcode() ? "passcode" : "open";
}

/** LAITURI_DEMO_ACCESS=off turns one-click demo access off; it is on by default. */
export function demoAccessEnabled(): boolean {
  return process.env.LAITURI_DEMO_ACCESS?.trim().toLowerCase() !== "off";
}

/** The audit-relevant part of a session: whose orders it decides, and whether the entry must name demo access. */
export function deciderOf(session: ApproverSession): Decider {
  return { buyerId: session.buyer.id, ...(session.demo ? { via: DEMO_VIA } : {}) };
}

async function buyerChoices(): Promise<BuyerChoice[]> {
  const mandates = await Promise.all(buyerIds().map((id) => currentMandate(id)));
  return mandates.map(({ mandate }) => ({ id: mandate.buyer.id, name: mandate.buyer.name, approver: mandate.approval.approver }));
}

async function sessionState(signedIn?: ApproverSession): Promise<ConsoleSession> {
  const base = { mode: sessionMode(), demoAccess: demoAccessEnabled(), buyers: await buyerChoices() };
  return signedIn ? { signedIn: true, ...signedIn, ...base } : { signedIn: false, ...base };
}

function sameSecret(given: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

function headerType(token: string): string | undefined {
  try {
    const header = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8")) as { typ?: unknown };
    return typeof header.typ === "string" ? header.typ : undefined;
  } catch {
    return undefined;
  }
}

function cookieValue(headers: Headers, name: string): string | undefined {
  const pair = (headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : undefined;
}

/** The session is a token signed with the approver key, kept in an HttpOnly cookie. */
async function issueSession(buyerId: string, demo: boolean): Promise<{ cookie: string; session: ConsoleSession }> {
  const { mandate } = await currentMandate(buyerId);
  const approver = mandate.approval.approver;
  const claims: SessionClaims = {
    sub: approver.id,
    name: approver.name,
    buyer: mandate.buyer.id,
    ...(demo ? { demo: true as const } : {}),
    exp: Math.floor(now().getTime() / 1000) + SESSION_HOURS * 3600,
  };
  const token = await trust().sign("approver", claims, { typ: SESSION_TYP });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const cookie = `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}${secure}`;
  const buyer = { id: mandate.buyer.id, name: mandate.buyer.name };
  return { cookie, session: await sessionState({ approver, buyer, demo }) };
}

/** Signs in the approver of one buyer, the primary buyer when none is named. */
export async function signIn(given: string | undefined, buyerId: string = PRIMARY_BUYER_ID): Promise<{ cookie: string; session: ConsoleSession }> {
  const expected = passcode();
  if (expected && !(given && sameSecret(given, expected))) {
    throw new ForbiddenError("The passcode is not correct.", "wrong_passcode");
  }
  if (!isKnownBuyer(buyerId)) throw new ValidationError(`No buyer with the id ${buyerId} is known.`);
  return issueSession(buyerId, false);
}

/** One-click demo access: the primary buyer's approver, no passcode, and every action it takes says so. */
export async function signInDemo(): Promise<{ cookie: string; session: ConsoleSession }> {
  if (!demoAccessEnabled()) throw new ForbiddenError("Demo access is turned off. Sign in with the passcode.", "demo_access_off");
  return issueSession(PRIMARY_BUYER_ID, true);
}

export function signOutCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

async function approverSession(headers: Headers): Promise<ApproverSession | undefined> {
  const token = cookieValue(headers, SESSION_COOKIE);
  if (!token) return undefined;
  const verified = await trust().verify<SessionClaims>("approver", token);
  const claims = verified.payload;
  // Approvals in the public log are signed with the same key, so only a session-typed token counts.
  const isSession =
    verified.valid &&
    headerType(token) === SESSION_TYP &&
    typeof claims?.sub === "string" &&
    typeof claims.name === "string" &&
    typeof claims.buyer === "string" &&
    isKnownBuyer(claims.buyer) &&
    typeof claims.exp === "number" &&
    claims.exp * 1000 > now().getTime() &&
    // Turning demo access off also ends the demo sessions already issued.
    (claims.demo !== true || demoAccessEnabled());
  if (!isSession || !claims) return undefined;
  const { mandate } = await currentMandate(claims.buyer);
  return {
    approver: { id: claims.sub, name: claims.name },
    buyer: { id: mandate.buyer.id, name: mandate.buyer.name },
    demo: claims.demo === true,
  };
}

export async function readSession(headers: Headers): Promise<ConsoleSession> {
  return sessionState(await approverSession(headers));
}

/** What a person may do in the console and an agent may not. */
const HUMAN_ACTIONS = {
  approve: "approve or reject orders",
  mandate: "change the mandate",
  reset: "reset the demo",
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
    if (error instanceof ForbiddenError) {
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

/** Human-only actions need a signed approver session. A header or an agent token is never enough. */
export async function requireApprover(headers: Headers, action: HumanAction = "approve"): Promise<ApproverSession> {
  if (bearerToken(headers)) {
    throw new ForbiddenError(`Agents cannot ${HUMAN_ACTIONS[action]}.`, "agent_not_allowed");
  }
  const session = await approverSession(headers);
  if (!session) throw new ForbiddenError("Sign in as the approver to do this.", "approver_sign_in_required");
  return session;
}
