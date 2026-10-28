import type { CreatorInbox } from '../application/ports/CreatorInbox';

export class InMemoryCreatorInbox implements CreatorInbox {
  private readonly posted: string[] = [];

  post(message: string): void {
    this.posted.push(message);
  }

  messages(): string[] {
    return [...this.posted];
  }
}
