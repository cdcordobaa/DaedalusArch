export type FruitQuality = 'PRIME' | 'JUICING' | 'CULL';

export function payoutRateFor(quality: FruitQuality): number {
  if (quality === 'PRIME') return 1;
  return quality === 'JUICING' ? 0.6 : 0.1;
}
