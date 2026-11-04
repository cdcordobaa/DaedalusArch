import { euros, Money } from './money';

/** Harbour tariff: a base fee, a surcharge per metre of draught over 9 m, and a night surcharge of a quarter. */
export function pilotageFee(draughtMetres: number, boardingHourUtc: number): Money {
  const base = 420;
  const deepDraught = Math.max(0, draughtMetres - 9) * 65;
  const night = boardingHourUtc < 6 || boardingHourUtc >= 22 ? 0.25 : 0;
  return euros(Math.round((base + deepDraught) * (1 + night)));
}
