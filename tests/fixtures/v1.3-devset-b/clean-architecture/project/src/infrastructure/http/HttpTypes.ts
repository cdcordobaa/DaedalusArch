export interface HttpRequest {
  params: Record<string, string>;
  body: Record<string, unknown>;
}

export interface HttpResponse {
  status: number;
  body: unknown;
}

export function ok(body: unknown): HttpResponse {
  return { status: 200, body };
}

export function created(body: unknown): HttpResponse {
  return { status: 201, body };
}

export function fail(status: number, message: string): HttpResponse {
  return { status, body: { error: message } };
}
