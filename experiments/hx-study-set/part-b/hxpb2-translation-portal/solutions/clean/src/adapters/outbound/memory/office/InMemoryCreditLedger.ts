import type { CreditLine } from '../../../../domain/model/office/CreditLine';
import type { CreditLedger } from '../../../../application/ports/out/office/CreditLedger';

export class InMemoryCreditLedger implements CreditLedger {
  private readonly lines = new Map<string, CreditLine>();

  async line(clientId: string): Promise<CreditLine | undefined> {
    return this.lines.get(clientId);
  }

  async keep(line: CreditLine): Promise<void> {
    this.lines.set(line.clientId, line);
  }
}
