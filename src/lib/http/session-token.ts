import { now } from "@/lib/clock";
import { TOKEN_TYPE, trust, type SignerRole } from "@/lib/trust";
import { currentWorkspace } from "@/lib/workspace/context";
import { cookieHeader, cookieValue } from "@/lib/workspace/cookie";
import { demoAccessEnabled } from "./sign-in";

/** A buyer's approver decides orders and the mandate; a wholesaler operator suspends and resumes agents. */
export type SessionRole = "approver" | "operator";

export interface SessionClaims {
  role: SessionRole;
  sub: string;
  name: string;
  /** The workspace the session was issued in; it is useless in any other. */
  ws: string;
  /** The buyer an approver decides for. */
  buyer?: string;
  demo?: true;
  exp: number;
}

/** Separate cookies, so one browser can be the hotel's approver and the wholesaler's operator in the same tour. */
export const SESSION_COOKIES: Record<SessionRole, string> = { approver: "laituri_approver", operator: "laituri_operator" };

/** Each role's token is signed by its own party's key. */
const SIGNER: Record<SessionRole, SignerRole> = { approver: "approver", operator: "supplier" };

const SESSION_HOURS = 12;

/** A Set-Cookie value holding a signed session bound to the current workspace. */
export async function sessionCookie(claims: Omit<SessionClaims, "ws" | "exp">): Promise<string> {
  const full: SessionClaims = {
    ...claims,
    ws: currentWorkspace().id,
    exp: Math.floor(now().getTime() / 1000) + SESSION_HOURS * 3600,
  };
  const token = await trust().sign(SIGNER[claims.role], full, TOKEN_TYPE.session);
  return cookieHeader(SESSION_COOKIES[claims.role], token, { maxAge: SESSION_HOURS * 3600, sameSite: "Strict" });
}

export function clearedSessionCookie(role: SessionRole): string {
  return cookieHeader(SESSION_COOKIES[role], "", { maxAge: 0, sameSite: "Strict" });
}

/** The role's session for the current workspace, or undefined when absent, forged, expired or issued elsewhere. */
export async function sessionClaims(headers: Headers, role: SessionRole): Promise<SessionClaims | undefined> {
  const token = cookieValue(headers, SESSION_COOKIES[role]);
  if (!token) return undefined;
  const verified = await trust().verify<Partial<SessionClaims>>(SIGNER[role], token, TOKEN_TYPE.session);
  const claims = verified.payload;
  const valid =
    verified.valid &&
    claims?.role === role &&
    claims.ws === currentWorkspace().id &&
    typeof claims.sub === "string" &&
    typeof claims.name === "string" &&
    typeof claims.exp === "number" &&
    claims.exp * 1000 > now().getTime() &&
    // Turning demo access off also ends the demo sessions already issued.
    (claims.demo !== true || demoAccessEnabled());
  return valid ? (claims as SessionClaims) : undefined;
}
