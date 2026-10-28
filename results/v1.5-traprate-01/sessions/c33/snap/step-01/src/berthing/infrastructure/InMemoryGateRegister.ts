import type { GateRegister } from '../application/ports/GateRegister';

export class InMemoryGateRegister implements GateRegister {
  private readonly allowed: string[] = [];

  allow(entry: string): void {
    if (!this.allowed.includes(entry)) this.allowed.push(entry);
  }

  entries(): string[] {
    return [...this.allowed];
  }
}
