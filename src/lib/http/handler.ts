import type { z } from "zod";
import { ValidationError } from "@/lib/gateway/errors";
import { refuseSuspendedCredential } from "./agent";
import { errorResponse } from "./respond";

/** Signed offers and mandates fit well inside this; nothing legitimate is larger. */
const MAX_BODY_CHARS = 64_000;

type Params = Record<string, string>;
type Context = { params: Promise<Params> };
type Handler = (request: Request, params: Params) => Promise<Response>;

/**
 * Wraps a route handler so every thrown error becomes a problem response.
 * A suspended agent's credential is refused before the handler runs, whatever the route serves.
 */
export function route(handler: Handler) {
  return async (request: Request, context?: Context): Promise<Response> => {
    try {
      await refuseSuspendedCredential(request);
      const params = context ? await context.params : {};
      return await handler(request, params);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** Reads and validates a JSON body. Throws a ZodError or ValidationError for the problem helper. */
export async function readBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  extend?: (body: Record<string, unknown>) => Record<string, unknown>,
): Promise<z.infer<S>> {
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) throw new ValidationError("The request body is too large.");
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new ValidationError("The request body is not valid JSON.");
  }
  if (extend && body && typeof body === "object" && !Array.isArray(body)) {
    body = extend(body as Record<string, unknown>);
  }
  return schema.parse(body);
}

/** Parses an optional integer query parameter. */
export function intParam(url: URL, name: string): number | undefined {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === "") return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError(`The ${name} parameter must be a whole number.`, [
      { path: name, message: "Expected a non-negative integer" },
    ]);
  }
  return value;
}
