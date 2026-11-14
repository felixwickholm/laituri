import { GatewayError, TooManyRequestsError } from "@/lib/gateway/errors";
import { createCreationLimit, type CreationLimit } from "@/lib/workspace/creation-limit";
import { currentWorkspace } from "@/lib/workspace/context";
import { refuseAgents } from "./agent";
import { callerAddress } from "./caller";
import { fullAccess } from "./reader";

const WINDOW_MS = 10 * 60_000;
/** A spoken turn is one transcription and one or two readings aloud; forty turns in ten minutes is a busy kitchen. */
export const VOICE_CALLS_PER_WORKSPACE = 100;
/** Several browsers can share one address (an event's Wi-Fi). */
export const VOICE_CALLS_PER_ADDRESS = 300;

const holder = globalThis as typeof globalThis & { __laituriVoiceLimits?: { address: CreationLimit; workspace: CreationLimit } };

function limits() {
  return (holder.__laituriVoiceLimits ??= {
    address: createCreationLimit({ max: () => VOICE_CALLS_PER_ADDRESS, windowMs: WINDOW_MS }),
    workspace: createCreationLimit({ max: () => VOICE_CALLS_PER_WORKSPACE, windowMs: WINDOW_MS }),
  });
}

export class VoiceCredentialRequiredError extends GatewayError {
  constructor() {
    super("Voice works in your own browser sandbox or with a signed-in session. Open Laituri in a browser first.", 401, "credential_required");
  }
}

/**
 * Voice calls a paid service, so it serves only a browser in its own sandbox or a signed-in person, never an agent or
 * a caller with no credential, and only so often per client address and per workspace.
 */
export async function requireVoiceCaller(request: Request): Promise<void> {
  refuseAgents(request.headers);
  if (!(await fullAccess(request))) throw new VoiceCredentialRequiredError();
  const { address, workspace } = limits();
  const checks = [address.check(callerAddress()), workspace.check(currentWorkspace().id)];
  const refused = checks.find((admission) => !admission.allowed);
  if (refused && !refused.allowed) {
    throw new TooManyRequestsError(`Too much voice in a short time. Try again in ${refused.retryAfterS} seconds.`, refused.retryAfterS);
  }
  address.admit(callerAddress());
  workspace.admit(currentWorkspace().id);
}
