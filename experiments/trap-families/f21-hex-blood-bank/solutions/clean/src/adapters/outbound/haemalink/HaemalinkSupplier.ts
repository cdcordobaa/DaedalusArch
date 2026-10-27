import { HaemalinkEmbargoError, HaemalinkError, type HaemalinkClient, type HlAboGroup, type HlProductCode } from 'haemalink-sdk';
import type { Supplier } from '../../../application/needs/Supplier';
import { isRhesusNegative, letters } from '../../../domain/BloodGroup';
import type { Component } from '../../../domain/Component';
import { SupplierFailed, SupplyHeld, type HoldReason } from '../../../domain/supply/SupplyHold';
import type { SupplyConfirmation, SupplyOrder } from '../../../domain/supply/SupplyOrder';

const PRODUCT: Record<Component, HlProductCode> = { 'red cells': 'RBC', platelets: 'PLT', plasma: 'FFP' };
const REASON: Record<HaemalinkEmbargoError['embargoCode'], HoldReason> = { REGIONAL_SHORTAGE: 'shortage', TTI_QUARANTINE: 'quarantine' };

/** Orders units from Haemalink, one order line per order, and tells its answer and its refusals in our terms. */
export class HaemalinkSupplier implements Supplier {
  constructor(private readonly client: HaemalinkClient) {}

  async order(order: SupplyOrder): Promise<SupplyConfirmation> {
    try {
      const receipt = await this.client.submitOrder({
        priority: order.urgent ? 'STAT' : 'ROUTINE',
        lines: [{ product: PRODUCT[order.component], abo: letters(order.group) as HlAboGroup, rhd: isRhesusNegative(order.group) ? 'NEG' : 'POS', qty: order.units }],
      });
      return { orderNumber: receipt.orderRef, confirmed: receipt.allocations[0]?.qtyAllocated ?? 0 };
    } catch (e) {
      if (e instanceof HaemalinkEmbargoError) throw new SupplyHeld({ reason: REASON[e.embargoCode], until: new Date(e.liftsAt) });
      if (e instanceof HaemalinkError) throw new SupplierFailed(e.message);
      throw e;
    }
  }
}
