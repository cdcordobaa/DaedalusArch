import { MarketService, TillWaveFeed, TillWaveSale } from '../application/market-service';

export class TillWaveHttpFeed implements TillWaveFeed {
  constructor(private readonly url: string, private readonly key: string) {}

  async fetchSince(cursor?: string): Promise<{ sales: TillWaveSale[]; cursor?: string }> {
    const res = await fetch(`${this.url}/sales${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { headers: { authorization: `Bearer ${this.key}` } });
    if (!res.ok) throw new Error(`TillWave responded ${res.status}`);
    const json = (await res.json()) as { items: { sale_id: string; merchant_id: string; amount_cents: number; timestamp: string }[]; cursor?: string };
    return { sales: json.items.map((i) => ({ id: i.sale_id, merchantId: i.merchant_id, cents: i.amount_cents, time: i.timestamp })), cursor: json.cursor };
  }
}

export function pollTillWaveEvery15Minutes(market: MarketService, feed: TillWaveFeed): NodeJS.Timeout {
  let cursor: string | undefined;
  const run = (): void => {
    market.pullTillWave(feed, cursor)
      .then((r) => { cursor = r.cursor; if (r.errors.length) console.warn('tillwave rejected', r.errors); })
      .catch((e: unknown) => console.error('tillwave poll failed', e));
  };
  run();
  return setInterval(run, 15 * 60 * 1000);
}
