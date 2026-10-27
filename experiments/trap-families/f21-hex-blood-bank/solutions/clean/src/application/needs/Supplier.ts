import type { SupplyConfirmation, SupplyOrder } from '../../domain/supply/SupplyOrder';

/**
 * The regional blood supplier. Rejects with SupplyHeld when the component and group are held back, and with
 * SupplierFailed on any other failure.
 */
export interface Supplier {
  order(order: SupplyOrder): Promise<SupplyConfirmation>;
}
