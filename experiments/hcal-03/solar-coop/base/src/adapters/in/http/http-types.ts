export interface HttpRequest<B = unknown> {
  readonly params: Record<string, string>;
  readonly body: B;
}

export interface HttpResponse<B = unknown> {
  readonly status: number;
  readonly body: B;
}
