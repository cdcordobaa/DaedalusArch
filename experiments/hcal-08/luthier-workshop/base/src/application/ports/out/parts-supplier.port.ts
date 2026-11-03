import { SupplyTicket } from '../../../domain/supply';

export interface PartsOrder {
  readonly partSku: string;
  readonly timber: string;
  readonly quantity: number;
}

export interface PartsSupplierPort {
  order(parts: PartsOrder): Promise<SupplyTicket>;
}
