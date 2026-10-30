import type { XRayCheck } from '../../../domain/model/admin/XRayCheck';
import type { XRayCheckStore } from '../../ports/out/admin/XRayCheckStore';

/** Staff-side list of a safety check of the x-ray unit */
export class XRayCheckService {
  constructor(private readonly store: XRayCheckStore) {}

  async add(id: string, text: string, at: string): Promise<XRayCheck> {
    if (text.trim() === '') throw new Error('text is required');
    const item: XRayCheck = { id, text: text.trim(), at };
    await this.store.add(item);
    return item;
  }

  async list(): Promise<XRayCheck[]> {
    return (await this.store.all()).slice().sort((x, y) => x.at.localeCompare(y.at));
  }
}
