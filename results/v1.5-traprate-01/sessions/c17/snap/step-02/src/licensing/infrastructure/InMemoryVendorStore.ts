import { Vendor, type VendorSnapshot } from '../domain/vendor/Vendor';
import type { VendorRepository } from '../domain/vendor/VendorRepository';
import { VendorId } from '../domain/vendor/value-objects/VendorId';

export class InMemoryVendorStore implements VendorRepository {
  private readonly rows = new Map<string, VendorSnapshot>();
  private counter = 100;

  allocateId(): VendorId {
    this.counter += 1;
    return VendorId.of(`V${String(this.counter)}`);
  }

  find(id: VendorId): Vendor | undefined {
    const row = this.rows.get(id.value);
    return row === undefined ? undefined : Vendor.fromSnapshot(row);
  }

  put(vendor: Vendor): void {
    this.rows.set(vendor.id.value, vendor.snapshot());
  }
}
