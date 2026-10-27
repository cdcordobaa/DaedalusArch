import type { HaemalinkClient, HlOrderReceipt, HlOrderRequest } from 'haemalink-sdk';
import type { SupplierOrders } from '../../../application/needs/SupplierOrders';

export class HaemalinkSupplierOrders implements SupplierOrders {
  constructor(private readonly client: HaemalinkClient) {}

  submit(request: HlOrderRequest): Promise<HlOrderReceipt> {
    return this.client.submitOrder(request);
  }
}
