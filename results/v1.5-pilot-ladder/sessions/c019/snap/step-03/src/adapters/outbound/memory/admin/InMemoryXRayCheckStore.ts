import type { XRayCheckStore } from '../../../../application/ports/out/admin/XRayCheckStore';
import type { XRayCheck } from '../../../../domain/model/admin/XRayCheck';

export class InMemoryXRayCheckStore implements XRayCheckStore {
  private readonly items: XRayCheck[] = [];

  async add(item: XRayCheck): Promise<void> {
    this.items.push(item);
  }

  async all(): Promise<XRayCheck[]> {
    return [...this.items];
  }
}
