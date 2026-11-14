import { jsonRequest } from "./env";
import { WORKSPACE_COOKIE, newWorkspaceSecret } from "@/lib/workspace/cookie";

type Params = Record<string, string>;
type Handler = (request: Request, context?: { params: Promise<Params> }) => Promise<Response>;

interface CallOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  params?: Params;
}

/**
 * A browser for route tests: a cookie jar that every answer's Set-Cookie updates. A new browser holds a workspace
 * secret, as the proxy gives one on the first page load, so its calls land in its own sandbox.
 */
export class Browser {
  private readonly jar = new Map<string, string>();

  constructor(options: { sandbox?: boolean } = {}) {
    if (options.sandbox !== false) this.jar.set(WORKSPACE_COOKIE, newWorkspaceSecret());
  }

  cookie(): string {
    return [...this.jar].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("; ");
  }

  async call(handler: Handler, pathname: string, options: CallOptions = {}): Promise<Response> {
    const headers = { ...(this.jar.size ? { cookie: this.cookie() } : {}), ...options.headers };
    const request = jsonRequest(pathname, { method: options.method, body: options.body, headers });
    const response = await handler(request, { params: Promise.resolve(options.params ?? {}) });
    this.keep(response);
    return response;
  }

  private keep(response: Response): void {
    for (const header of response.headers.getSetCookie()) {
      const [pair, ...attributes] = header.split(";");
      const name = pair.slice(0, pair.indexOf("="));
      const value = decodeURIComponent(pair.slice(name.length + 1));
      const cleared = attributes.some((attribute) => attribute.trim().toLowerCase() === "max-age=0");
      if (cleared) this.jar.delete(name);
      else this.jar.set(name, value);
    }
  }
}
