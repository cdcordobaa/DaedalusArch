export type MetalReadiness = 'reserved' | 'shipped' | 'arrived' | 'refused';

export interface MetalLot {
  readonly lotRef: string;
  readonly readiness: MetalReadiness;
  readonly arrivalDate: string | null;
  readonly tin_pct: number;
}
