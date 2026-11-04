export type ColonyVigour = 'strong' | 'fair' | 'weak' | 'lost';

export interface ColonyReading {
  readonly hiveTag: string;
  readonly vigour: ColonyVigour;
  readonly broodTempC: number;
  readonly takenAt: string;
}

/** A colony whose brood is below 33 degrees counts as weak, whatever the sensor reports. */
export function assessedVigour(reading: ColonyReading): ColonyVigour {
  if (reading.vigour !== 'lost' && reading.broodTempC < 33) return 'weak';
  return reading.vigour;
}

/** A placement may go out when at least four in five of its colonies read strong or fair. */
export function deliverable(readings: readonly ColonyReading[]): boolean {
  if (readings.length === 0) return false;
  const fit = readings.map(assessedVigour).filter((v) => v === 'strong' || v === 'fair').length;
  return fit / readings.length >= 0.8;
}
