// Typings of the Kilnwise kiln-controller SDK (kilnwise-sdk 3.2), as shipped by the vendor.
declare module 'kilnwise-sdk' {
  export type KilnwisePhase = 'SCHEDULED' | 'CANDLING' | 'RAMPING' | 'HOLDING' | 'COOLING' | 'COMPLETE' | 'FAULTED';
  export type KilnwiseProgram = 'BISQUE' | 'GLAZE';
  export interface KilnwiseFiringRequest {
    label: string;
    program: KilnwiseProgram;
    peakCelsius: number;
    shelves: number;
  }
  export interface KilnwiseFiring {
    firingId: string;
    kilnName: string;
  }
  export interface KilnwiseReading {
    phase: KilnwisePhase;
    celsius: number;
    takenAt: string;
  }
  export interface KilnwiseFiringStatus {
    firingId: string;
    /** Newest first. */
    readings: KilnwiseReading[];
  }
  export class KilnwiseError extends Error {}
  export class KilnwiseClient {
    constructor(options: { token: string; studio: string });
    scheduleFiring(request: KilnwiseFiringRequest): Promise<KilnwiseFiring>;
    firingStatus(firingId: string): Promise<KilnwiseFiringStatus>;
  }
}
