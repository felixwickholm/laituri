import { ZodError } from "zod";
import { isGatewayError } from "@/lib/gateway/errors";

export const PROBLEM_TYPE_BASE = "urn:laituri:problem:";

export interface Violation {
  path: string;
  message: string;
}

/** RFC 9457 problem details, plus a stable machine code. */
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  violations?: Violation[];
}

const TITLES: Record<number, string> = {
  400: "Invalid request",
  401: "Unknown credentials",
  403: "Not allowed",
  404: "Not found",
  405: "Method not allowed",
  409: "Conflict",
  422: "Cannot process",
  500: "Internal error",
  502: "Wholesaler unavailable",
};

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function problem(status: number, code: string, detail: string, violations?: Violation[]): Response {
  const body: Problem = {
    type: PROBLEM_TYPE_BASE + code,
    title: TITLES[status] ?? "Error",
    status,
    detail,
    code,
    ...(violations?.length ? { violations } : {}),
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/problem+json", "cache-control": "no-store" },
  });
}

export function violationsOf(error: ZodError): Violation[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join(".") || "(body)",
    message: issue.message,
  }));
}

/** Maps any thrown value to a problem response. Unknown errors never leak internals. */
export function errorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    return problem(400, "invalid_request", "The request does not match the schema.", violationsOf(error));
  }
  if (isGatewayError(error)) {
    const details = error.details instanceof ZodError ? violationsOf(error.details) : asViolations(error.details);
    return problem(error.status, error.code, error.message, details);
  }
  console.error(error);
  return problem(500, "internal_error", "Something went wrong on our side. Try again.");
}

function asViolations(details: unknown): Violation[] | undefined {
  if (!Array.isArray(details)) return undefined;
  const list: Violation[] = [];
  for (const item of details) {
    if (typeof item?.message !== "string") continue;
    const path = Array.isArray(item.path) ? item.path.map(String).join(".") : String(item.path ?? "");
    list.push({ path: path || "(body)", message: item.message });
  }
  return list.length ? list : undefined;
}
