export type LatchCondition = 'faulty' | 'sound';

/** What the locker bank itself tells us about a latch. */
export interface LockerFaults {
  report(buildingId: string, bay: number, condition: LatchCondition): { locker: string; inService: boolean };
}
