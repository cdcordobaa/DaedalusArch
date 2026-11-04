export type ToneColour = 'bright' | 'warm' | 'dark';

export type MetalReadiness = 'reserved' | 'shipped' | 'arrived' | 'refused';

export interface MetalLot {
  readonly lotRef: string;
  readonly readiness: MetalReadiness;
  readonly arrivalDate: string | null;
  readonly tone: ToneColour;
}
