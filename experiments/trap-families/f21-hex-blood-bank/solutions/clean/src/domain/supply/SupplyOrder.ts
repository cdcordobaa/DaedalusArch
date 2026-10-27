import type { BloodGroup } from '../BloodGroup';
import type { Component } from '../Component';

/** Units we ask the regional supplier for: one component, one blood group. */
export interface SupplyOrder {
  readonly component: Component;
  readonly group: BloodGroup;
  readonly units: number;
  readonly urgent: boolean;
}

/** What the supplier confirmed for an order: possibly fewer units than asked, or none. */
export interface SupplyConfirmation {
  readonly orderNumber: string;
  readonly confirmed: number;
}
