/**
 * Marks a GatewayError. Next bundles routes into separate module graphs, so one error class can exist twice in a
 * process and instanceof fails across them; a symbol from the global registry is the same in every copy.
 */
const GATEWAY_ERROR = Symbol.for("laituri.gateway-error");

/** Base for every error the gateway reports to callers, with an HTTP status and a stable machine code. */
export class GatewayError extends Error {
  readonly [GATEWAY_ERROR] = true;

  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends GatewayError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "invalid_request", details);
  }
}

export class NotFoundError extends GatewayError {
  constructor(message: string) {
    super(message, 404, "not_found");
  }
}

/** The same idempotency key was reused for a different offer. */
export class ConflictError extends GatewayError {
  constructor(message: string) {
    super(message, 409, "idempotency_conflict");
  }
}

/** The requested action does not fit the current state, for example deciding an order twice. */
export class StateError extends GatewayError {
  constructor(message: string) {
    super(message, 409, "invalid_state");
  }
}

/** The audit log no longer verifies, so nothing may be approved on top of it. */
export class AuditBrokenError extends GatewayError {
  constructor(message: string) {
    super(message, 409, "audit_broken");
  }
}

/** The wholesaler has suspended the calling agent, so it refuses every call until the agent is resumed. */
export class AgentSuspendedError extends GatewayError {
  constructor(message: string) {
    super(message, 403, "agent_suspended");
  }
}

/** A record could not be written to disk, so the call that made it did not happen. */
export class StorageError extends GatewayError {
  constructor(message: string) {
    super(message, 503, "storage_unavailable");
  }
}

export class UpstreamError extends GatewayError {
  constructor(message: string, details?: unknown) {
    super(message, 502, "upstream_unavailable", details);
  }
}

/** True for a GatewayError from any copy of this module. */
export function isGatewayError(error: unknown): error is GatewayError {
  if (!(error instanceof Error)) return false;
  const marked = error as Partial<GatewayError> & { [GATEWAY_ERROR]?: unknown };
  return marked[GATEWAY_ERROR] === true && typeof marked.status === "number" && typeof marked.code === "string";
}

/** A GatewayError with this status, from any copy of this module. */
export function hasStatus(error: unknown, status: number): error is GatewayError {
  return isGatewayError(error) && error.status === status;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
