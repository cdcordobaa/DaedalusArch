import type { ToolLoanStore } from '../../../../application/ports/out/admin/ToolLoanStore';
import type { ToolLoan } from '../../../../domain/model/admin/ToolLoan';

export class InMemoryToolLoanStore implements ToolLoanStore {
  private readonly items: ToolLoan[] = [];

  async add(item: ToolLoan): Promise<void> {
    this.items.push(item);
  }

  async all(): Promise<ToolLoan[]> {
    return [...this.items];
  }
}
