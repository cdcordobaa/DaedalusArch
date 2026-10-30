import type { ToiletBlockCheck } from '../../../domain/model/admin/ToiletBlockCheck';
import type { ToiletBlockCheckStore } from '../../ports/out/admin/ToiletBlockCheckStore';

/** Staff-side list of a cleaning round of a toilet block */
export class ToiletBlockCheckService {
  constructor(private readonly store: ToiletBlockCheckStore) {}

  async add(id: string, text: string, at: string): Promise<ToiletBlockCheck> {
    if (text.trim() === '') throw new Error('text is required');
    const item: ToiletBlockCheck = { id, text: text.trim(), at };
    await this.store.add(item);
    return item;
  }

  async list(): Promise<ToiletBlockCheck[]> {
    return (await this.store.all()).slice().sort((x, y) => x.at.localeCompare(y.at));
  }
}
