import { SchoolError } from '../SchoolError';

/** Minutes since midnight of a time written HH:MM (24 hours). */
export function parseTime(value: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (m === null) throw new SchoolError(`not a time: ${value}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
