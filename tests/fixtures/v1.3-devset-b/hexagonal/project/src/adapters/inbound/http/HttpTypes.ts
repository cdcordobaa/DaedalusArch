export interface HttpRequest {
  params: Record<string, string>;
  query: Record<string, string>;
  body: Record<string, unknown>;
}

export interface HttpResponse {
  status: number;
  body: unknown;
}

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}
