export type ColonyVigour = 'strong' | 'fair' | 'weak' | 'lost';

export interface ColonyReading {
  readonly hiveTag: string;
  readonly vigour: ColonyVigour;
  readonly broodTempC: number;
  readonly takenAt: string;
  readonly weight_kg: number;
}

/** A placement may go out when at least four in five of its colonies read strong or fair. */
export function deliverable(readings: readonly ColonyReading[]): boolean {
  if (readings.length === 0) return false;
  const fit = readings.filter((r) => r.vigour === 'strong' || r.vigour === 'fair').length;
  return fit / readings.length >= 0.8;
}
