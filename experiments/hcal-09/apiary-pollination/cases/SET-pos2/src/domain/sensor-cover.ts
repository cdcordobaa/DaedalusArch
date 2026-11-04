export const LEASE_STATES = ['ACTIVE', 'PAUSED', 'ENDED'] as const;
export type LeaseState = (typeof LEASE_STATES)[number];

export interface SensorCover {
  readonly leaseRef: string;
  readonly state: string;
  readonly units: number;
}
