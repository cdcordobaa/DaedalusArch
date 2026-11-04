import { HiveCondition } from './hive-condition';

export interface ColonyReading {
  readonly hiveTag: string;
  readonly condition: HiveCondition;
  readonly broodTempC: number;
  readonly takenAt: string;
}

/** A placement may go out when at least four in five of its colonies read thriving or nominal. */
export function deliverable(readings: readonly ColonyReading[]): boolean {
  if (readings.length === 0) return false;
  const fit = readings.filter((r) => r.condition === HiveCondition.thriving || r.condition === HiveCondition.nominal).length;
  return fit / readings.length >= 0.8;
}
