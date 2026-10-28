import type { Vendor } from './Vendor';
import type { VendorId } from './value-objects/VendorId';

export interface VendorRepository {
  allocateId(): VendorId;
  find(id: VendorId): Vendor | undefined;
  put(vendor: Vendor): void;
}
