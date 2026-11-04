import { TideSlot } from '../../../domain/tide-slot';

export interface SlotRequest {
  readonly vesselImo: string;
  readonly draughtMetres: number;
  readonly etaUtc: string;
}

export interface TideWindowPort {
  requestSlot(request: SlotRequest): Promise<TideSlot>;
}
