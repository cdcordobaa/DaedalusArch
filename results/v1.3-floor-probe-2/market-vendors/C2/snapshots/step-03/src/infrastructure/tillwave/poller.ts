import { SalesUseCases } from '../../application/use-cases/sales';

interface TillWaveSaleDto { id: string; merchantId: string; amount: number; createdAt: string }

/** Polls TillWave's HTTP API every 15 minutes for sales after the last one seen. */
export class TillWavePoller {
  private lastSeen?: string;
  private timer?: NodeJS.Timeout;

  constructor(private readonly sales: SalesUseCases, private readonly baseUrl: string, private readonly apiKey: string, private readonly everyMs = 15 * 60_000) {}

  start(): void {
    void this.pollOnce();
    this.timer = setInterval(() => void this.pollOnce(), this.everyMs);
  }

  stop(): void { if (this.timer) clearInterval(this.timer); }

  async pollOnce(): Promise<number> {
    const q = this.lastSeen ? `?after=${encodeURIComponent(this.lastSeen)}` : '';
    let rows: TillWaveSaleDto[];
    try {
      const res = await fetch(`${this.baseUrl}/sales${q}`, { headers: { 'x-api-key': this.apiKey } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      rows = (await res.json()) as TillWaveSaleDto[];
    } catch (e) {
      console.error('[tillwave] poll failed', e);
      return 0;
    }
    let n = 0;
    for (const r of rows) {
      try {
        this.sales.acceptTillWaveSale(r.id, r.merchantId, r.amount, r.createdAt);
        n++;
      } catch (e) {
        console.warn(`[tillwave] sale ${r.id} rejected: ${(e as Error).message}`);
      }
      if (!this.lastSeen || r.createdAt > this.lastSeen) this.lastSeen = r.createdAt;
    }
    return n;
  }
}
