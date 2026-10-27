import { HaemalinkEmbargoError, type HlOrderLine } from 'haemalink-sdk';
import type { BloodGroup } from '../domain/BloodGroup';
import type { Component } from '../domain/Component';
import { UnitRequest } from '../domain/UnitRequest';
import type { Fridge } from './needs/Fridge';
import type { SupplierOrders } from './needs/SupplierOrders';
import type { RequestAnswer, RequestUnits, UnitRequestInput } from './RequestUnits';

const PRODUCT: Record<Component, HlOrderLine['product']> = { 'red cells': 'RBC', platelets: 'PLT', plasma: 'FFP' };

type Embargo = { embargoCode: HaemalinkEmbargoError['embargoCode']; liftsAt: string };

export class RequestUnitsService implements RequestUnits {
  private readonly embargoes = new Map<string, Embargo>();

  constructor(
    private readonly fridge: Fridge,
    private readonly supplier: SupplierOrders,
  ) {}

  async request(input: UnitRequestInput): Promise<RequestAnswer> {
    const request = UnitRequest.of(input);
    const fromStock = Math.min(request.units, this.fridge.onHand(request.component, request.group));
    const own = await this.order(request.component, request.group, request.units - fromStock, request.urgent);

    let fromONegStock = 0;
    let cover: { qty: number; orderRef: string | null; embargo: Embargo | null } = { qty: 0, orderRef: null, embargo: null };
    const missing = request.units - fromStock - own.qty;
    if (missing > 0 && request.urgent && request.component === 'red cells' && request.group !== 'O-') {
      fromONegStock = Math.min(missing, this.fridge.onHand('red cells', 'O-'));
      cover = await this.order('red cells', 'O-', missing - fromONegStock, true);
    }

    if (fromStock > 0) this.fridge.take(request.component, request.group, fromStock);
    if (fromONegStock > 0) this.fridge.take('red cells', 'O-', fromONegStock);
    const substituted = fromONegStock + cover.qty;
    const outstanding = request.units - fromStock - own.qty - substituted;
    const given = fromStock + own.qty + substituted;
    const status = outstanding === 0 ? 'filled' : own.embargo !== null ? 'on hold' : given === 0 ? 'unfilled' : 'partly filled';
    return {
      fromStock,
      fromSupplier: own.qty,
      substituted,
      outstanding,
      status,
      supplierOrder: own.orderRef,
      coverOrder: cover.orderRef,
      holdReason: own.embargo === null ? null : own.embargo.embargoCode === 'REGIONAL_SHORTAGE' ? 'shortage' : 'quarantine',
      holdUntil: own.embargo === null ? null : new Date(own.embargo.liftsAt).toISOString(),
    };
  }

  private async order(component: Component, group: BloodGroup, qty: number, urgent: boolean): Promise<{ qty: number; orderRef: string | null; embargo: Embargo | null }> {
    if (qty <= 0) return { qty: 0, orderRef: null, embargo: null };
    const key = `${component}|${group}`;
    const known = this.embargoes.get(key);
    if (known !== undefined && Date.now() <= Date.parse(known.liftsAt)) return { qty: 0, orderRef: null, embargo: known };
    try {
      const receipt = await this.supplier.submit({
        priority: urgent ? 'STAT' : 'ROUTINE',
        lines: [{ product: PRODUCT[component], abo: group.slice(0, -1) as HlOrderLine['abo'], rhd: group.endsWith('-') ? 'NEG' : 'POS', qty }],
      });
      const line = receipt.allocations[0];
      return { qty: line === undefined || line.allocationStatus === 'BACKORDERED' ? 0 : line.qtyAllocated, orderRef: receipt.orderRef, embargo: null };
    } catch (e) {
      if (!(e instanceof HaemalinkEmbargoError)) throw e;
      const embargo = { embargoCode: e.embargoCode, liftsAt: e.liftsAt };
      this.embargoes.set(key, embargo);
      return { qty: 0, orderRef: null, embargo };
    }
  }
}
