import type { Messages } from '../application/ports/Messages';

export class InMemoryMessages implements Messages {
  private readonly lines: string[] = [];

  add(text: string): void {
    this.lines.push(text);
  }

  all(): string[] {
    return [...this.lines];
  }
}
