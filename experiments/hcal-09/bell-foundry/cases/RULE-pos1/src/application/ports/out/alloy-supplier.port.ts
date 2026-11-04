import { MetalLot } from '../../../domain/metal-lot';

export interface AlloyOrder {
  readonly alloy: 'bell-bronze';
  readonly bellWeightKg: number;
}

export interface AlloySupplierPort {
  order(order: AlloyOrder): Promise<MetalLot>;
}
