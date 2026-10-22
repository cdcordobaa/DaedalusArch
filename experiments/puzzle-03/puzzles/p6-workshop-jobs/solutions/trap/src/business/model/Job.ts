import type { JobRecord } from '../../persistence/records/JobRecord';
import { formatCents, jobTotalCents } from '../rules/Pricing';

export interface JobView {
  readonly id: string;
  readonly plate: string;
  readonly mechanicId: string;
  readonly status: 'open' | 'closed';
  readonly openedOn: string;
  readonly total: string | null;
}

export function toView(record: JobRecord): JobView {
  return {
    id: record.id,
    plate: record.plate,
    mechanicId: record.mechanicId,
    status: record.closedOn === null ? 'open' : 'closed',
    openedOn: record.openedOn,
    total: record.closedOn === null ? null : formatCents(jobTotalCents(record.labourMinutes, record.partsCents)),
  };
}

/** UK-style plates: letters and digits, 2 to 8 of them, spaces ignored. */
export function normalisePlate(plate: string): string | null {
  const p = plate.replace(/\s+/g, '').toUpperCase();
  return /^[A-Z0-9]{2,8}$/.test(p) ? p : null;
}
