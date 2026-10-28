import type { BloodGroup } from '../../domain/BloodGroup';
import type { Component } from '../../domain/Component';

export interface SupplyOrder {
  readonly component: Component;
  readonly group: BloodGroup;
  readonly units: number;
  readonly urgent: boolean;
}

export interface SupplyConfirmation {
  readonly orderNumber: string;
  /** Units the supplier confirmed; may be fewer than ordered, or none. */
  readonly confirmed: number;
}

/** The regional supplier we order missing units from. Rejects when the supplier does not answer. */
export interface Supplier {
  order(order: SupplyOrder): Promise<SupplyConfirmation>;
}
