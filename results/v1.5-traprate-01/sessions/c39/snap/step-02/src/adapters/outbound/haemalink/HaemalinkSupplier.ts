import { HaemalinkEmbargoError, type HaemalinkClient, type HlAboGroup, type HlProductCode, type HlRhD } from 'haemalink-sdk';
import type { Supplier, SupplyConfirmation, SupplyHold, SupplyOrder } from '../../../application/needs/Supplier';
import { isRhesusNegative, letters } from '../../../domain/BloodGroup';
import type { Component } from '../../../domain/Component';

const PRODUCT: Record<Component, HlProductCode> = {
  'red cells': 'RBC',
  platelets: 'PLT',
  plasma: 'FFP',
};

/** Orders missing units from Haemalink and tells the answer in our words. */
export class HaemalinkSupplier implements Supplier {
  constructor(private readonly client: HaemalinkClient) {}

  async order(order: SupplyOrder): Promise<SupplyConfirmation | SupplyHold> {
    try {
      return await this.submit(order);
    } catch (e) {
      if (e instanceof HaemalinkEmbargoError) {
        return { hold: e.embargoCode === 'TTI_QUARANTINE' ? 'quarantine' : 'shortage', until: e.liftsAt };
      }
      throw e;
    }
  }

  private async submit(order: SupplyOrder): Promise<SupplyConfirmation> {
    const receipt = await this.client.submitOrder({
      priority: order.urgent ? 'STAT' : 'ROUTINE',
      lines: [
        {
          product: PRODUCT[order.component],
          abo: letters(order.group) as HlAboGroup,
          rhd: (isRhesusNegative(order.group) ? 'NEG' : 'POS') satisfies HlRhD,
          qty: order.units,
        },
      ],
    });
    const allocated = receipt.allocations.reduce((sum, a) => sum + a.qtyAllocated, 0);
    return { orderNumber: receipt.orderRef, confirmed: Math.max(0, Math.min(order.units, allocated)) };
  }
}
