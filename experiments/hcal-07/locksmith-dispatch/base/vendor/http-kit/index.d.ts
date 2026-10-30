export type HttpMethod = 'GET' | 'POST' | 'DELETE';

export interface HttpRequest {
  method: HttpMethod;
  path: string;
  params: Record<string, string>;
  body: unknown;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export class HttpError extends Error {
  constructor(status: number, message: string);
  readonly status: number;
}

export function json(status: number, body: unknown): HttpResponse;
