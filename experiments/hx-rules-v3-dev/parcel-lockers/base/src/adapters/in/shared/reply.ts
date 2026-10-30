export interface HttpReply {
  readonly status: number;
  readonly body: unknown;
}

export function replyOf(status: number, body: unknown): HttpReply {
  return { status, body };
}
