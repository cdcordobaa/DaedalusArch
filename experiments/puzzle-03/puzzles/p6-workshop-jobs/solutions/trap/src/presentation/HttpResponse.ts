export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

export function handle(run: () => unknown): HttpResponse {
  try {
    return { status: 200, body: run() };
  } catch (e) {
    return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } };
  }
}
