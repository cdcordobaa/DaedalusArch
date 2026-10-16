import { IncomingMessage, ServerResponse } from "node:http";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Route {
  method: string;
  path: string; // e.g. /volunteers/:id
  handler: (ctx: RequestContext) => Promise<{ status: number; body?: unknown }>;
}

export interface RequestContext {
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Malformed JSON body");
  }
}

function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split("/");
  const a = path.split("/");
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(":")) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}

export function createDispatcher(routes: Route[]) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const send = (status: number, body?: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(body === undefined ? "" : JSON.stringify(body));
    };
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      let pathMatched = false;
      for (const r of routes) {
        const params = match(r.path, url.pathname);
        if (!params) continue;
        pathMatched = true;
        if (r.method !== req.method) continue;
        const body = req.method === "GET" || req.method === "DELETE" ? {} : await readJson(req);
        const out = await r.handler({ params, query: url.searchParams, body });
        return send(out.status, out.body);
      }
      send(pathMatched ? 405 : 404, { error: pathMatched ? "Method not allowed" : "Not found" });
    } catch (e) {
      if (e instanceof HttpError) return send(e.status, { error: e.message });
      console.error(e);
      send(500, { error: "Internal server error" });
    }
  };
}

export function obj(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "Body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

export function str(v: unknown, field: string): string {
  if (typeof v !== "string" || v.trim() === "") throw new HttpError(400, `${field} is required`);
  return v.trim();
}
