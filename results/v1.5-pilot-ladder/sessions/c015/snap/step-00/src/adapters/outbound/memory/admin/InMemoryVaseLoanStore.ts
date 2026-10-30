import type { VaseLoanStore } from '../../../../application/ports/out/admin/VaseLoanStore';
import type { VaseLoan } from '../../../../domain/model/admin/VaseLoan';

export class InMemoryVaseLoanStore implements VaseLoanStore {
  private readonly items: VaseLoan[] = [];

  async add(item: VaseLoan): Promise<void> {
    this.items.push(item);
  }

  async all(): Promise<VaseLoan[]> {
    return [...this.items];
  }
}
