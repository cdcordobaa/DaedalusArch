export type TimberClass = 'MASTER' | 'CONCERT' | 'WORKSHOP' | 'STUDENT';

export function surchargeFor(timber: TimberClass): number {
  if (timber === 'MASTER') return 180;
  if (timber === 'CONCERT') return 90;
  return timber === 'WORKSHOP' ? 30 : 0;
}
