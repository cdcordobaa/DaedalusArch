import type { HlOrderReceipt, HlOrderRequest } from 'haemalink-sdk';

/** Orders placed with the regional supplier. */
export interface SupplierOrders {
  submit(request: HlOrderRequest): Promise<HlOrderReceipt>;
}
