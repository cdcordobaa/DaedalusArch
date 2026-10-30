import { DispatchOrder } from './dispatch-order';
import { palletsFor } from './freight';

export const MANIFEST_COLUMNS: string[] = ['consignment_no', 'consignee_postcode', 'pallet_count', 'gross_weight_kg'];

export function manifestLine(order: DispatchOrder): string {
  const values = [order.freightReference ?? '', order.postcode, String(palletsFor(order.trays)), String(order.weightKg)];
  return MANIFEST_COLUMNS.map((column, i) => `${column}=${values[i]}`).join(',');
}
