import type { BloodGroup } from '../../domain/BloodGroup';
import type { Component } from '../../domain/Component';

export interface SupplierOrder {
  readonly component: Component;
  readonly group: BloodGroup;
  readonly units: number;
  readonly urgent: boolean;
}

export interface SupplierConfirmation {
  /** The supplier's order number. */
  readonly orderNumber: string;
  /** Units the supplier confirmed, possibly fewer than ordered or none. */
  readonly units: number;
  /** Set when the supplier refused because of an embargo; nothing was ordered. */
  readonly hold?: SupplierHold;
}

export interface SupplierHold {
  readonly reason: 'shortage' | 'quarantine';
  /** ISO 8601 time the embargo lifts. */
  readonly until: string;
}

/** The regional blood supplier, asked for units our own fridge cannot give. */
export interface Supplier {
  order(order: SupplierOrder): Promise<SupplierConfirmation>;
}
