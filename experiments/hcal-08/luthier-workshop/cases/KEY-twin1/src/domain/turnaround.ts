const BENCH_DAYS: { [kind: string]: number } = {
  violin: 3,
  viola: 3,
  cello: 5,
  guitar: 4,
};

export function benchDaysFor(kind: string): number {
  return BENCH_DAYS[kind] ?? 5;
}
