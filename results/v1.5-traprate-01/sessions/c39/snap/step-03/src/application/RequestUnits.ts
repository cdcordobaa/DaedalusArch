import type { FulfilmentStatus } from '../domain/Fulfilment';

export interface UnitRequestInput {
  readonly ward: string;
  readonly component: string;
  readonly group: string;
  readonly units: number;
  readonly urgent?: boolean;
}

export interface RequestAnswer {
  readonly fromStock: number;
  readonly fromSupplier: number;
  /** Haemalink's order number, or null when the supplier was not asked. */
  readonly supplierOrder: string | null;
  /** O negative red cells given in place of the requested group, from the fridge and Haemalink together. */
  readonly substituted: number;
  /** Haemalink's number of the O negative cover order, or null when none was placed. */
  readonly coverOrder: string | null;
  readonly outstanding: number;
  readonly status: FulfilmentStatus;
  readonly holdReason: 'shortage' | 'quarantine' | null;
  /** ISO 8601 time the embargo lifts, or null. */
  readonly holdUntil: string | null;
}

/** A ward asks the blood bank for units of one component and blood group. */
export interface RequestUnits {
  request(input: UnitRequestInput): Promise<RequestAnswer>;
}
