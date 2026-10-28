import { HaemalinkEmbargoError } from 'haemalink-sdk';
import type { HaemalinkClient, HlAboGroup, HlOrderReceipt, HlProductCode } from 'haemalink-sdk';
import type { Supplier, SupplierConfirmation, SupplierOrder } from '../../../application/needs/Supplier';
import { isRhesusNegative, letters } from '../../../domain/BloodGroup';
import type { Component } from '../../../domain/Component';

const PRODUCT: Record<Component, HlProductCode> = {
  'red cells': 'RBC',
  platelets: 'PLT',
  plasma: 'FFP',
};

/** Orders missing units from Haemalink in one order with one line. */
export class HaemalinkSupplier implements Supplier {
  constructor(private readonly client: HaemalinkClient) {}

  async order(order: SupplierOrder): Promise<SupplierConfirmation> {
    let receipt: HlOrderReceipt;
    try {
      receipt = await this.client.submitOrder({
        priority: order.urgent ? 'STAT' : 'ROUTINE',
        lines: [
          {
            product: PRODUCT[order.component],
            abo: letters(order.group) as HlAboGroup,
            rhd: isRhesusNegative(order.group) ? 'NEG' : 'POS',
            qty: order.units,
          },
        ],
      });
    } catch (e) {
      if (e instanceof HaemalinkEmbargoError) {
        const reason = e.embargoCode === 'TTI_QUARANTINE' ? 'quarantine' : 'shortage';
        return { orderNumber: '', units: 0, hold: { reason, until: e.liftsAt } };
      }
      throw e;
    }
    const allocated = receipt.allocations.reduce((sum, a) => sum + a.qtyAllocated, 0);
    return { orderNumber: receipt.orderRef, units: Math.max(0, Math.min(order.units, allocated)) };
  }
}
