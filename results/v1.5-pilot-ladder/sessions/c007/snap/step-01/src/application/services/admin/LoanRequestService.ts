import type { LoanRequest } from '../../../domain/model/admin/LoanRequest';
import type { LoanRequestStore } from '../../ports/out/admin/LoanRequestStore';

/** Staff-side list of a request to lend a painting to another museum */
export class LoanRequestService {
  constructor(private readonly store: LoanRequestStore) {}

  async add(id: string, text: string, at: string): Promise<LoanRequest> {
    if (text.trim() === '') throw new Error('text is required');
    const item: LoanRequest = { id, text: text.trim(), at };
    await this.store.add(item);
    return item;
  }

  async list(): Promise<LoanRequest[]> {
    return (await this.store.all()).slice().sort((x, y) => x.at.localeCompare(y.at));
  }
}
