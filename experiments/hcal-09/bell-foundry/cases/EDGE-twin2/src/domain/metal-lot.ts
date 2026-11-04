export type MetalReadiness = 'reserved' | 'shipped' | 'arrived' | 'refused';

export const isFinalReadiness = (readiness: MetalReadiness): boolean => readiness === 'arrived' || readiness === 'refused';

export interface MetalLot {
  readonly lotRef: string;
  readonly readiness: MetalReadiness;
  readonly arrivalDate: string | null;
}
