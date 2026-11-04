export type Clearance = 'ample' | 'tight' | 'none';

export interface TideSlot {
  readonly slotRef: string;
  readonly opensAt: string;
  readonly closesAt: string;
  readonly underKeelMargin: number;
}

/** Harbour master's standing order: under 0.5 m of water below the keel the pilot boards with a second pilot. */
export function clearanceOf(slot: TideSlot): Clearance {
  if (slot.underKeelMargin <= 0) return 'none';
  return slot.underKeelMargin < 0.5 ? 'tight' : 'ample';
}
