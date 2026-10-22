import type { Receipts } from '../application/ports/Receipts';

export class InMemoryReceipts implements Receipts {
  private readonly lines: string[] = [];

  add(text: string): void {
    this.lines.push(text);
  }

  all(): string[] {
    return [...this.lines];
  }
}
