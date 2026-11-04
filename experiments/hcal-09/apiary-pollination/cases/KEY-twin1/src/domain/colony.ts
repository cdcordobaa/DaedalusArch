export type ColonyVigour = 'strong' | 'fair' | 'weak' | 'lost';

export interface ColonyReading {
  readonly hiveTag: string;
  readonly vigour: ColonyVigour;
  readonly broodTempC: number;
  readonly takenAt: string;
}

const FIT_TO_GO: Record<ColonyVigour, boolean> = { strong: true, fair: true, weak: false, lost: false };

/** A placement may go out when at least four in five of its colonies read strong or fair. */
export function deliverable(readings: readonly ColonyReading[]): boolean {
  if (readings.length === 0) return false;
  const fit = readings.filter((r) => FIT_TO_GO[r.vigour]).length;
  return fit / readings.length >= 0.8;
}
