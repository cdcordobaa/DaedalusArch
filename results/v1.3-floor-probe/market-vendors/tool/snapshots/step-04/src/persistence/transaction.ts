import { FeeSchedule } from './models';
import {
  auditLog,
  balances,
  bookings,
  cardSales,
  feeSchedule,
  marketDays,
  merchantLinks,
  pitches,
  readerLinks,
  settlements,
  vendors,
} from './store';

const tables = [auditLog, bookings, cardSales, marketDays, merchantLinks, pitches, readerLinks, settlements, vendors];

let depth = 0;

/** Runs `work` so that all its writes (data and audit) are kept together or rolled back together. */
export function inTransaction<T>(work: () => T): T {
  if (depth > 0) return work();
  const snaps = tables.map((t) => t.snapshot());
  const balanceSnap = new Map(balances);
  const feeSnap: FeeSchedule = JSON.parse(JSON.stringify(feeSchedule)) as FeeSchedule;
  depth++;
  try {
    return work();
  } catch (e) {
    tables.forEach((t, i) => (t.restore as (s: unknown) => void)(snaps[i]));
    balances.clear();
    balanceSnap.forEach((v, k) => balances.set(k, v));
    Object.assign(feeSchedule, feeSnap);
    throw e;
  } finally {
    depth--;
  }
}
