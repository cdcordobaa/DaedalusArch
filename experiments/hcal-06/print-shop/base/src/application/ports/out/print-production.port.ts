import { Finish } from '../../../domain/order-status';
import { ProductionTicket } from '../../../domain/production';

export interface PrintSpec {
  readonly sku: string;
  readonly pageCount: number;
  readonly copies: number;
  readonly finish: Finish;
  readonly postcode: string;
}

export interface PrintProductionPort {
  submit(spec: PrintSpec): Promise<ProductionTicket>;
}
