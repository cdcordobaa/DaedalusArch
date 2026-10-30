export type LatchFault = 'jammed' | 'left-open' | 'cleared';

/** What the lockbank hubs tell us: a latch at a bay failed, or is working again. */
export interface ReportLatchFaults {
  /** Idempotent: out of service on a fault, back in service on cleared. */
  report(buildingId: string, bay: number, fault: LatchFault): { locker: string; inService: boolean };
}
