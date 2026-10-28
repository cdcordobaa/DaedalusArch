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

/** The supplier refused the order because the component and group are embargoed until `until` (ISO 8601). */
export interface SupplyHold {
  readonly hold: 'shortage' | 'quarantine';
  readonly until: string;
}

/** The regional supplier we order missing units from. Rejects when the supplier does not answer. */
export interface Supplier {
  order(order: SupplyOrder): Promise<SupplyConfirmation | SupplyHold>;
}
