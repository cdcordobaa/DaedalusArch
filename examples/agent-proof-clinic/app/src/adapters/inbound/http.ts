export interface HttpRequest {
  method: string;
  path: string;
  body?: unknown;
}

export interface HttpResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export type HttpHandler = (request: HttpRequest) => Promise<HttpResponse>;
