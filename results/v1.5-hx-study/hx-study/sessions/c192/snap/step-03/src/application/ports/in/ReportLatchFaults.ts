export type LatchFault = 'jammed' | 'left-open' | 'cleared';

/** What a locker bank's hub tells us about a latch. */
export interface ReportLatchFaults {
  latchFault(buildingId: string, bay: number, fault: LatchFault): { locker: string; inService: boolean };
}
