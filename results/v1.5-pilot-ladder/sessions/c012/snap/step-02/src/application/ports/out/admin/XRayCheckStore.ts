import type { XRayCheck } from '../../../../domain/model/admin/XRayCheck';

export interface XRayCheckStore {
  add(item: XRayCheck): Promise<void>;
  all(): Promise<XRayCheck[]>;
}
