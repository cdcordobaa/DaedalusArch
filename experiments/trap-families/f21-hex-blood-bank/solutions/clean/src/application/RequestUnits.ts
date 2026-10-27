import type { FulfilmentStatus } from '../domain/Fulfilment';
import type { HoldReason } from '../domain/supply/SupplyHold';

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
  readonly substituted: number;
  readonly outstanding: number;
  readonly status: FulfilmentStatus;
  readonly supplierOrder: string | null;
  readonly coverOrder: string | null;
  readonly holdReason: HoldReason | null;
  readonly holdUntil: string | null;
}

/** A ward asks the blood bank for units of one component and blood group. */
export interface RequestUnits {
  request(input: UnitRequestInput): Promise<RequestAnswer>;
}
