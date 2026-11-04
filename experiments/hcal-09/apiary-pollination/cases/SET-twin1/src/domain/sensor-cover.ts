export type SensorCoverage = 'full' | 'partial' | 'none';

export interface SensorCover {
  readonly leaseRef: string;
  readonly active: boolean;
  readonly units: number;
  readonly coverage: SensorCoverage;
}
