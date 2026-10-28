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
  readonly supplierOrder: string | null;
  readonly outstanding: number;
  readonly status: FulfilmentStatus;
  readonly holdReason: 'shortage' | 'quarantine' | null;
  readonly holdUntil: string | null;
}

/** A ward asks the blood bank for units of one component and blood group. */
export interface RequestUnits {
  request(input: UnitRequestInput): Promise<RequestAnswer>;
}
