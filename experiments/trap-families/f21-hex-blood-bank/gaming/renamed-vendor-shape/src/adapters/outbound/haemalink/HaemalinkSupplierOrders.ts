import type { HaemalinkClient, HlAboGroup, HlProductCode } from 'haemalink-sdk';
import type { SupplierOrders, SupplyReceipt, SupplyRequest } from '../../../application/needs/SupplierOrders';
import type { Component } from '../../../domain/Component';

const PRODUCT: Record<Component, HlProductCode> = { 'red cells': 'RBC', platelets: 'PLT', plasma: 'FFP' };

export class HaemalinkSupplierOrders implements SupplierOrders {
  constructor(private readonly client: HaemalinkClient) {}

  submit(request: SupplyRequest): Promise<SupplyReceipt> {
    return this.client.submitOrder({
      priority: request.priority === 'urgent' ? 'STAT' : 'ROUTINE',
      lines: request.lines.map((l) => ({ product: PRODUCT[l.product], abo: l.abo.slice(0, -1) as HlAboGroup, rhd: l.abo.endsWith('-') ? 'NEG' : 'POS', qty: l.qty })),
    });
  }
}
