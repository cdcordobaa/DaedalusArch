import type { IncomingMessage, ServerResponse } from "node:http";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Request {
  method: string;
  path: string;
  params: Record<string, string>;
  body: unknown;
  query: Record<string, string>;
}

export interface Response {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export type Handler = (req: Request) => Promise<Response> | Response;

export interface Route {
  method: string;
  pattern: string;
  handler: Handler;
}

function matchPattern(pattern: string, path: string): Record<string, string> | undefined {
  const p = pattern.split("/").filter(Boolean);
  const a = path.split("/").filter(Boolean);
  if (p.length !== a.length) return undefined;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    const seg = p[i] as string;
    const val = a[i] as string;
    if (seg.startsWith(":")) params[seg.slice(1)] = decodeURIComponent(val);
    else if (seg !== val) return undefined;
  }
  return params;
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

export async function dispatch(
  routes: Route[],
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const send = (status: number, body?: unknown, headers?: Record<string, string>): void => {
    res.statusCode = status;
    for (const [k, v] of Object.entries(headers ?? {})) res.setHeader(k, v);
    if (body === undefined) {
      res.end();
      return;
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
  };
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const method = req.method ?? "GET";
    let pathMatched = false;
    for (const r of routes) {
      const params = matchPattern(r.pattern, url.pathname);
      if (!params) continue;
      pathMatched = true;
      if (r.method !== method) continue;
      const body = method === "GET" || method === "DELETE" ? undefined : await readBody(req);
      const out = await r.handler({ method, path: url.pathname, params, body, query: Object.fromEntries(url.searchParams) });
      send(out.status, out.body, out.headers);
      return;
    }
    send(pathMatched ? 405 : 404, { error: pathMatched ? "Method not allowed" : "Not found" });
  } catch (e) {
    if (e instanceof HttpError) send(e.status, { error: e.message });
    else {
      console.error(e);
      send(500, { error: "Internal server error" });
    }
  }
}

export function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

export function str(o: Record<string, unknown>, key: string): string {
  const v = o[key];
  if (typeof v !== "string" || v.trim() === "") throw new HttpError(400, `${key} must be a non-empty string`);
  return v.trim();
}

export function num(o: Record<string, unknown>, key: string): number {
  const v = o[key];
  if (typeof v !== "number" || !Number.isFinite(v)) throw new HttpError(400, `${key} must be a number`);
  return v;
}
