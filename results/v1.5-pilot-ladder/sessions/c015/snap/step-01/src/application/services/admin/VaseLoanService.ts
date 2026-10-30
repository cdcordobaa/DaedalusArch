import type { VaseLoan } from '../../../domain/model/admin/VaseLoan';
import type { VaseLoanStore } from '../../ports/out/admin/VaseLoanStore';

/** Staff-side list of a vase lent to a customer */
export class VaseLoanService {
  constructor(private readonly store: VaseLoanStore) {}

  async add(id: string, text: string, at: string): Promise<VaseLoan> {
    if (text.trim() === '') throw new Error('text is required');
    const item: VaseLoan = { id, text: text.trim(), at };
    await this.store.add(item);
    return item;
  }

  async list(): Promise<VaseLoan[]> {
    return (await this.store.all()).slice().sort((x, y) => x.at.localeCompare(y.at));
  }
}
