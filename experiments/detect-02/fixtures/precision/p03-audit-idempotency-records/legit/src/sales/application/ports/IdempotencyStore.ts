export interface StoredResponse {
  readonly key: string;
  readonly orderId: string;
}

/** Remembers the response to a request key so a retried request returns the same result. */
export interface IdempotencyStore {
  find(key: string): Promise<StoredResponse | undefined>;
  remember(response: StoredResponse): Promise<void>;
}
