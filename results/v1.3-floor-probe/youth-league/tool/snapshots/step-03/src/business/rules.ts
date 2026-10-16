import { AgeGroup, Fixture } from './entities';

/** Season starts on 1 September of the year the season starts in. */
export function seasonStartYear(today: Date): number {
  return today.getUTCMonth() >= 8 ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
}

export function ageOn(birthDate: string, on: Date): number {
  const b = new Date(`${birthDate}T00:00:00Z`);
  let age = on.getUTCFullYear() - b.getUTCFullYear();
  const beforeBirthday = on.getUTCMonth() < b.getUTCMonth() || (on.getUTCMonth() === b.getUTCMonth() && on.getUTCDate() < b.getUTCDate());
  if (beforeBirthday) age--;
  return age;
}

/** UN means: under N on 1 September of the season. */
export function fitsAgeGroup(birthDate: string, group: AgeGroup, seasonYear: number): boolean {
  const limit = Number(group.slice(1));
  return ageOn(birthDate, new Date(Date.UTC(seasonYear, 8, 1))) < limit;
}

export function sameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

export const FIXTURE_LENGTH_MINUTES = 90;

export function overlaps(a: Fixture, b: Fixture): boolean {
  const start = (f: Fixture): number => new Date(f.kickOff).getTime();
  return Math.abs(start(a) - start(b)) < FIXTURE_LENGTH_MINUTES * 60000;
}
