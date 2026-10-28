import type { Confirmations } from '../application/ports/Confirmations';

export class InMemoryConfirmations implements Confirmations {
  private readonly lines: string[] = [];

  add(text: string): void {
    this.lines.push(text);
  }

  all(): string[] {
    return [...this.lines];
  }
}
