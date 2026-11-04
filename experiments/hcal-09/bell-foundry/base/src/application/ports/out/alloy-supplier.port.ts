import { MetalLot } from '../../../domain/metal-lot';

export interface AlloyOrder {
  readonly alloy: 'bell-bronze';
  readonly massKg: number;
}

export interface AlloySupplierPort {
  order(order: AlloyOrder): Promise<MetalLot>;
}
