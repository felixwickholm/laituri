/** Base for every error the gateway reports to callers, with an HTTP status and a stable machine code. */
export class GatewayError extends Error {
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

export class UpstreamError extends GatewayError {
  constructor(message: string, details?: unknown) {
    super(message, 502, "upstream_unavailable", details);
  }
}

export function isGatewayError(error: unknown): error is GatewayError {
  return error instanceof GatewayError;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
