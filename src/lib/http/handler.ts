import type { z } from "zod";
import { ValidationError } from "@/lib/gateway/errors";
import { inWorkspace } from "@/lib/workspace/context";
import { refuseSuspendedCredential } from "./agent";
import { readCappedText } from "./body";
import { asCaller } from "./caller";
import { refuseCrossSite } from "./same-origin";
import { refuseSharedWrite } from "./shared-view";
import { errorResponse } from "./respond";
import { resolveWorkspace } from "./workspace";

/** Signed offers and mandates fit well inside this; nothing legitimate is larger. */
export const MAX_BODY_BYTES = 64 * 1024;

type Params = Record<string, string>;
type Context = { params: Promise<Params> };
type Handler = (request: Request, params: Params) => Promise<Response>;

export interface RouteOptions {
  /**
   * A caller without a sandbox may call this without a session: signing in, switching back to a sandbox, or making
   * one. A browser looking at the shared workspace and a caller with no credential at all only read elsewhere.
   */
  openInSharedView?: boolean;
}

/**
 * Wraps a route handler: it runs in the caller's workspace, and every thrown error becomes a problem response.
 * A cookie-carrying write from another site is refused first. A suspended agent's credential is refused before the
 * handler runs, whatever the route serves. A browser looking at the shared workspace, and a caller with neither a
 * credential nor a sandbox cookie, only read there unless signed in.
 */
export function route(handler: Handler, options: RouteOptions = {}) {
  return (request: Request, context?: Context): Promise<Response> =>
    asCaller(request.headers, async () => {
      try {
        refuseCrossSite(request);
        const { workspace, access } = await resolveWorkspace(request.headers);
        return await inWorkspace(workspace, async () => {
          await refuseSuspendedCredential(request);
          if ((access === "shared-view" || access === "anonymous") && !options.openInSharedView) await refuseSharedWrite(request, access);
          const params = context ? await context.params : {};
          return await handler(request, params);
        });
      } catch (error) {
        return errorResponse(error);
      }
    });
}

/** Reads and validates a JSON body. Throws a ZodError or ValidationError for the problem helper. */
export async function readBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  extend?: (body: Record<string, unknown>) => Record<string, unknown>,
): Promise<z.infer<S>> {
  const text = await readCappedText(request, MAX_BODY_BYTES);
  let body: unknown;
  try {
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
