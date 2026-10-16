export interface HttpRequest {
  params: Record<string, string>;
  body: Record<string, unknown>;
}

export interface HttpResponse {
  status: number;
  body: unknown;
}
