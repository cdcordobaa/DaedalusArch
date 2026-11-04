export type Clearance = 'ample' | 'tight' | 'none';

export interface TideSlot {
  readonly slotRef: string;
  readonly opensAt: string;
  readonly closesAt: string;
  readonly clearance: Clearance;
}
