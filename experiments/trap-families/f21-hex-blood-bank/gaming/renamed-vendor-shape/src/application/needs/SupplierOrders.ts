import type { BloodGroup } from '../../domain/BloodGroup';
import type { Component } from '../../domain/Component';

export interface SupplyRequestLine {
  readonly product: Component;
  readonly abo: BloodGroup;
  readonly qty: number;
}

export interface SupplyRequest {
  readonly priority: 'urgent' | 'routine';
  readonly lines: SupplyRequestLine[];
}

export interface SupplyAllocation {
  readonly qtyAllocated: number;
  readonly allocationStatus: string;
}

/** What the supplier answered for an order. */
export interface SupplyReceipt {
  readonly orderRef: string;
  readonly allocations: SupplyAllocation[];
}

/** Orders placed with the regional supplier. */
export interface SupplierOrders {
  submit(request: SupplyRequest): Promise<SupplyReceipt>;
}
