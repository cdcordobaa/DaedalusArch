export type Bench = 'WORKSHOP' | 'SPRAY_BOOTH' | 'SETUP_BENCH';

export function benchDays(bench: Bench): number {
  if (bench === 'SPRAY_BOOTH') return 4;
  return bench === 'SETUP_BENCH' ? 1 : 2;
}
