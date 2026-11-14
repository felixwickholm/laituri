import { createHash, timingSafeEqual } from "node:crypto";
import { appendAudit } from "@/lib/audit";
import { now } from "@/lib/clock";
import { currentMandate } from "@/lib/mandate";
import { trust } from "@/lib/trust";
import { ANONYMOUS_AGENT, DEMO_AGENT_NAME, ForbiddenError, bearerToken } from "./agent";

export const SESSION_COOKIE = "laituri_approver";
const SESSION_HOURS = 12;
const SESSION_TYP = "console+jwt";

interface SessionClaims {
  sub: string;
  name: string;
  exp: number;
}

export interface ConsoleSession {
  signedIn: boolean;
  approver?: { id: string; name: string };
  /** "passcode": the approver must know LAITURI_APPROVER_PASSCODE. "open": anyone may sign in; local demos only. */
  mode: "passcode" | "open";
}

function passcode(): string | undefined {
  return process.env.LAITURI_APPROVER_PASSCODE?.trim() || undefined;
}

export function sessionMode(): ConsoleSession["mode"] {
  return passcode() ? "passcode" : "open";
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

/** Signs the approver in. The session is a token signed with the approver key, kept in an HttpOnly cookie. */
export async function signIn(given: string | undefined): Promise<{ cookie: string; session: ConsoleSession }> {
  const expected = passcode();
  if (expected && !(given && sameSecret(given, expected))) {
    throw new ForbiddenError("The passcode is not correct.", "wrong_passcode");
  }
  const { mandate } = await currentMandate();
  const approver = mandate.approval.approver;
  const claims: SessionClaims = {
    sub: approver.id,
    name: approver.name,
    exp: Math.floor(now().getTime() / 1000) + SESSION_HOURS * 3600,
  };
  const token = await trust().sign("approver", claims, { typ: SESSION_TYP });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const cookie = `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}${secure}`;
  return { cookie, session: { signedIn: true, approver, mode: sessionMode() } };
}

export function signOutCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export async function readSession(headers: Headers): Promise<ConsoleSession> {
  const mode = sessionMode();
  const token = cookieValue(headers, SESSION_COOKIE);
  if (!token) return { signedIn: false, mode };
  const verified = await trust().verify<SessionClaims>("approver", token);
  const claims = verified.payload;
  // Approvals in the public log are signed with the same key, so only a session-typed token counts.
  const isSession =
    verified.valid &&
    headerType(token) === SESSION_TYP &&
    typeof claims?.sub === "string" &&
    typeof claims.name === "string" &&
    typeof claims.exp === "number" &&
    claims.exp * 1000 > now().getTime();
  if (!isSession || !claims) return { signedIn: false, mode };
  return { signedIn: true, approver: { id: claims.sub, name: claims.name }, mode };
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
): Promise<{ id: string; name: string }> {
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
export async function requireApprover(headers: Headers, action: HumanAction = "approve"): Promise<{ id: string; name: string }> {
  if (bearerToken(headers)) {
    throw new ForbiddenError(`Agents cannot ${HUMAN_ACTIONS[action]}.`, "agent_not_allowed");
  }
  const session = await readSession(headers);
  if (!session.signedIn || !session.approver) {
    throw new ForbiddenError("Sign in as the approver to do this.", "approver_sign_in_required");
  }
  return session.approver;
}
