export type MetalReadiness = 'reserved' | 'shipped' | 'arrived' | 'refused' | 'tested';

export interface MetalLot {
  readonly lotRef: string;
  readonly readiness: MetalReadiness;
  readonly arrivalDate: string | null;
}
