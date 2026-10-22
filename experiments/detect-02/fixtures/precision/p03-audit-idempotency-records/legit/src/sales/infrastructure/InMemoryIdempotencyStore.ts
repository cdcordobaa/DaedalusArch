import type { IdempotencyStore, StoredResponse } from '../application/ports/IdempotencyStore';

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly rows = new Map<string, StoredResponse>();

  async find(key: string): Promise<StoredResponse | undefined> {
    return this.rows.get(key);
  }

  async remember(response: StoredResponse): Promise<void> {
    this.rows.set(response.key, response);
  }
}
