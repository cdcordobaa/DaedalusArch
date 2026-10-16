import { MarketService, TillWaveGateway, TillWaveSale } from "../application/market-service";

const POLL_INTERVAL_MS = 15 * 60 * 1000;

/** Reads sales from the TillWave HTTP API: GET {baseUrl}/sales?since=<ISO> -> [{ id, merchantId, amount (cents), time }]. */
export class HttpTillWaveGateway implements TillWaveGateway {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
  ) {}

  async fetchSales(since?: string): Promise<TillWaveSale[]> {
    const url = new URL("sales", this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`);
    if (since) url.searchParams.set("since", since);
    const res = await fetch(url, { headers: this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {} });
    if (!res.ok) throw new Error(`TillWave responded ${res.status}`);
    const data: unknown = await res.json();
    const list = Array.isArray(data) ? data : (data as { sales?: unknown } | null)?.sales;
    if (!Array.isArray(list)) throw new Error("unexpected TillWave response");
    return list.map((raw) => {
      const s = (raw ?? {}) as Record<string, unknown>;
      return {
        id: s.id as string,
        merchantId: s.merchantId as string,
        amountCents: s.amount as number,
        time: s.time as string,
      };
    });
  }
}

export function startTillWavePoller(service: MarketService, gateway: TillWaveGateway): NodeJS.Timeout {
  let running = false;
  const poll = async () => {
    if (running) return;
    running = true;
    try {
      const r = await service.pollTillWave(gateway);
      console.log(`tillwave poll: ${r.imported} imported, ${r.duplicates} duplicate, ${r.rejected} rejected`);
    } catch (e) {
      console.error("tillwave poll failed", e);
    } finally {
      running = false;
    }
  };
  void poll();
  return setInterval(poll, POLL_INTERVAL_MS);
}
