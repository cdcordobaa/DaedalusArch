import type { ToolLoan } from '../../../domain/model/admin/ToolLoan';
import type { ToolLoanStore } from '../../ports/out/admin/ToolLoanStore';

/** Staff-side list of a tool lent from the shed */
export class ToolLoanService {
  constructor(private readonly store: ToolLoanStore) {}

  async add(id: string, text: string, at: string): Promise<ToolLoan> {
    if (text.trim() === '') throw new Error('text is required');
    const item: ToolLoan = { id, text: text.trim(), at };
    await this.store.add(item);
    return item;
  }

  async list(): Promise<ToolLoan[]> {
    return (await this.store.all()).slice().sort((x, y) => x.at.localeCompare(y.at));
  }
}
