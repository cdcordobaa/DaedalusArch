import { euros, Money } from './money';

/** Harbour tariff: a base fee, a surcharge per metre of draught over 9 m, and a night surcharge of a quarter. */
const SIZE_FACTOR = new Map<string, number>([
  ['PANAMAX', 1.4],
  ['HANDYSIZE', 1.15],
  ['FEEDER', 1],
  ['COASTER', 0.85],
]);

export function pilotageFee(draughtMetres: number, boardingHourUtc: number, hullClass: string): Money {
  const base = 420;
  const deepDraught = Math.max(0, draughtMetres - 9) * 65;
  const night = boardingHourUtc < 6 || boardingHourUtc >= 22 ? 0.25 : 0;
  const size = SIZE_FACTOR.get(hullClass) ?? 1;
  return euros(Math.round((base + deepDraught) * size * (1 + night)));
}
