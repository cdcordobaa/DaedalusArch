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
  recordedAt?: string;
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
  cancelled?: boolean;
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

export interface TreatmentProduct {
  name: string;
  withdrawalDays: number;
}

export interface Treatment {
  id: string;
  hiveId: string;
  product: string;
  startDate: string;
  endDate: string;
}

export interface Harvest {
  id: string;
  hiveId: string;
  date: string;
  kg: number;
}

const addDays = (date: string, days: number): string => new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);

/**
 * A hive is flagged from an inspection above the threshold until a treatment is recorded and a later
 * inspection is at or below the threshold.
 */
export function isFlagged(inspections: Inspection[], treatments: Treatment[]): boolean {
  const sorted = [...inspections].sort((a, b) => a.date.localeCompare(b.date));
  let flaggedSince: string | undefined;
  for (const i of sorted) {
    if (i.varroaPer100 > VARROA_THRESHOLD) {
      flaggedSince ??= i.date;
    } else if (flaggedSince) {
      const since = flaggedSince;
      const treated = treatments.some((t) => t.startDate >= since && t.startDate <= i.date);
      if (treated) flaggedSince = undefined;
    }
  }
  return flaggedSince !== undefined;
}

/** The first date a harvest is allowed again after the treatment, or undefined if no restriction applies. */
export function harvestAllowedFrom(t: Treatment, product: TreatmentProduct | undefined): string {
  return addDays(t.endDate, (product?.withdrawalDays ?? 0) + 1);
}

export function harvestBlockedBy(date: string, treatments: Treatment[], products: Map<string, TreatmentProduct>): Treatment | undefined {
  return treatments.find((t) => date >= t.startDate && date < harvestAllowedFrom(t, products.get(t.product)));
}
