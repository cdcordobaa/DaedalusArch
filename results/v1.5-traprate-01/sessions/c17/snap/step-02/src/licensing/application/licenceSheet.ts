import type { VendorRepository } from '../domain/vendor/VendorRepository';
import { VendorId } from '../domain/vendor/value-objects/VendorId';
import type { LicenceSheet } from '../published/LicenceSheet';

export function licenceSheet(vendors: VendorRepository, vendorId: string): LicenceSheet | undefined {
  const v = vendors.find(VendorId.of(vendorId));
  if (v === undefined) return undefined;
  return { vendorId: v.id.value, tradingName: v.tradingName, inspectionScore: v.inspectionScore, strikes: v.strikes, status: v.licenceStatus(), lastTraded: v.lastTraded };
}
