import type { FinanceDrop } from '../../../application/ports/out/FinanceDrop';

/** The finance office's shared folder, kept in memory. */
export class FinanceFolder implements FinanceDrop {
  private readonly files = new Map<string, string>();

  put(name: string, text: string): void {
    this.files.set(name, text);
  }

  read(name: string): string | null {
    return this.files.get(name) ?? null;
  }

  names(): string[] {
    return [...this.files.keys()].sort();
  }
}
