import { Finish } from '../../../domain/order-status';
import { ProductionSnapshot, ProductionTicket } from '../../../domain/production';

export interface PrintSpec {
  readonly sku: string;
  readonly pageCount: number;
  readonly copies: number;
  readonly finish: Finish;
  readonly postcode: string;
}

export interface PrintProductionPort {
  submit(spec: PrintSpec): Promise<ProductionTicket>;
  snapshot(productionRef: string): Promise<ProductionSnapshot>;
}
