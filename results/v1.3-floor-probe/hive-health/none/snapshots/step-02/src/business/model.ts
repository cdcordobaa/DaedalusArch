export interface Member {
  id: string;
  name: string;
  phone?: string;
}

export interface Apiary {
  id: string;
  name: string;
  region: string;
  ownerId: string;
}

export interface Hive {
  id: string;
  apiaryId: string;
  ownerId: string;
  label: string;
}

export interface Inspection {
  id: string;
  hiveId: string;
  date: string;
  queenSeen: boolean;
  broodFrames: number;
  temperament: number;
  varroaPer100: number;
  recordedBy: string;
}

export interface ScaleReading {
  serial: string;
  hiveId: string;
  kg: number;
  time: string;
}

export interface SwarmAlert {
  hiveId: string;
  dropKg: number;
  at: string;
  sentTo?: string;
}

export const VARROA_THRESHOLD = 3;
export const SWARM_DROP_KG = 2;
export const SWARM_WINDOW_MS = 60 * 60 * 1000;

/** The weight drop within the hour before `latest`, from the highest earlier reading. */
export function dropWithinHour(readings: ScaleReading[], latest: ScaleReading): number {
  const t = new Date(latest.time).getTime();
  const window = readings.filter((r) => {
    const rt = new Date(r.time).getTime();
    return rt < t && t - rt <= SWARM_WINDOW_MS;
  });
  if (window.length === 0) return 0;
  return Math.max(...window.map((r) => r.kg)) - latest.kg;
}

export class DomainError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export function validateInspection(i: Omit<Inspection, 'id'>): void {
  if (!/^\d{4}-\d{2}-\d{2}/.test(i.date)) throw new DomainError('date must be YYYY-MM-DD');
  if (!(Number.isInteger(i.temperament) && i.temperament >= 1 && i.temperament <= 5)) throw new DomainError('temperament must be 1 to 5');
  if (!(i.broodFrames >= 0)) throw new DomainError('broodFrames must be 0 or more');
  if (!(i.varroaPer100 >= 0)) throw new DomainError('varroaPer100 must be 0 or more');
}

export function needsTreatment(latest: Inspection | undefined): boolean {
  return !!latest && latest.varroaPer100 > VARROA_THRESHOLD;
}
