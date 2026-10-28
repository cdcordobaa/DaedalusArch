import type { AgreementStore } from '../../../application/ports/out/AgreementStore';
import type { Agreement } from '../../../domain/model/Agreement';

export class InMemoryAgreementStore implements AgreementStore {
  private readonly rows = new Map<string, Agreement>();
  private counter = 0;

  nextId(): string {
    this.counter += 1;
    return `TA-${String(this.counter)}`;
  }

  async get(id: string): Promise<Agreement | undefined> {
    return this.rows.get(id);
  }

  async save(agreement: Agreement): Promise<void> {
    this.rows.set(agreement.id, agreement);
  }

  async all(): Promise<Agreement[]> {
    return [...this.rows.values()];
  }
}
