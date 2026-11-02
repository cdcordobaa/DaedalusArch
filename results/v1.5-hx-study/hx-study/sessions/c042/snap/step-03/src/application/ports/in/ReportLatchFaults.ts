export type LatchFault = 'jammed' | 'left-open' | 'cleared';

/** What the LockBank hubs tell us: a latch at a bay is faulty, or fine again. */
export interface ReportLatchFaults {
  report(buildingId: string, bay: number, fault: LatchFault): { locker: string; inService: boolean };
}
