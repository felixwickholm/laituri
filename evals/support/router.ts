import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

/** Origin used for in-process requests. Nothing listens here; `call` goes straight to the route handlers. */
export const ORIGIN = "http://localhost:3210";
export const AGENT_TOKEN = "demo-agent-token";
export const AGENT_AUTH = { authorization: `Bearer ${AGENT_TOKEN}` };

type Params = Record<string, string>;
type Handler = (request: Request, context?: { params: Promise<Params> }) => Response | Promise<Response>;

export interface Reply {
  status: number;
  contentType: string;
  text: string;
  /** Parsed body when it is JSON. */
  body: unknown;
  headers: Headers;
}

export interface CallOptions {
  body?: unknown;
  headers?: Record<string, string>;
}

const APP_DIR = path.join(process.cwd(), "src", "app");

/** Maps a URL path to the App Router file that serves it, filling dynamic segments such as [id]. */
function resolveRoute(pathname: string): { file: string; params: Params } | undefined {
  let dir = APP_DIR;
  const params: Params = {};
  for (const raw of pathname.split("/").filter(Boolean)) {
    const segment = decodeURIComponent(raw);
    const exact = path.join(dir, segment);
    if (!segment.includes("..") && !segment.startsWith("[") && existsSync(exact)) {
      dir = exact;
      continue;
    }
    const dynamic = readdirSync(dir).find((name) => /^\[\w+\]$/.test(name));
    if (!dynamic) return undefined;
    params[dynamic.slice(1, -1)] = segment;
    dir = path.join(dir, dynamic);
  }
  const file = path.join(dir, "route.ts");
  return existsSync(file) ? { file, params } : undefined;
}

function reply(status: number, text: string, headers: Headers): Reply {
  const contentType = headers.get("content-type") ?? "";
  let body: unknown;
  try {
    body = text && contentType.includes("json") ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }
  return { status, contentType, text, body, headers };
}

/** Hands a request to the App Router route handler that serves its path, as Next.js would. */
export async function dispatch(request: Request): Promise<Response> {
  const route = resolveRoute(new URL(request.url).pathname);
  if (!route) return new Response("No route serves this path.", { status: 404 });
  const handlers = (await import(route.file)) as Record<string, Handler | undefined>;
  const handler = handlers[request.method];
  if (!handler) return new Response(`The route has no ${request.method} handler.`, { status: 405 });
  return handler(request, { params: Promise.resolve(route.params) });
}

/** Calls the route handler for a method and URL in process, without a server. */
export async function call(method: string, url: string, options: CallOptions = {}): Promise<Reply> {
  const body = options.body === undefined ? undefined : typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  const headers = { ...(body === undefined ? {} : { "content-type": "application/json" }), ...options.headers };
  const response = await dispatch(new Request(new URL(url, ORIGIN), { method: method.toUpperCase(), headers, body }));
  return reply(response.status, await response.text(), response.headers);
}

export const get = (url: string, headers?: Record<string, string>) => call("GET", url, { headers });
export const post = (url: string, body: unknown, headers?: Record<string, string>) => call("POST", url, { body, headers });

/** A JSON body, typed by the caller. Throws with the problem detail when the call failed. */
export function ok<T>(result: Reply, what: string): T {
  if (result.status >= 400) {
    const detail = (result.body as { detail?: string } | undefined)?.detail ?? result.text.slice(0, 120);
    throw new Error(`${what} answered ${result.status}: ${detail}`);
  }
  return result.body as T;
}

export function isClientError(status: number): boolean {
  return status >= 400 && status < 500;
}
