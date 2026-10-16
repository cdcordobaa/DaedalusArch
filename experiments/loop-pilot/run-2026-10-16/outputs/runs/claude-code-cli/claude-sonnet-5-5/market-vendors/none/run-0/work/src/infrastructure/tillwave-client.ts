import type { TillWaveGateway } from "../application/tillwave-sync.js";
import type { TillWaveSale } from "../domain/entities.js";

interface RawSale {
  id?: unknown;
  merchantId?: unknown;
  amount?: unknown;
  time?: unknown;
}

/** HTTP client for the TillWave sales API (amounts in cents). */
export class HttpTillWaveGateway implements TillWaveGateway {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
  ) {}

  async fetchSales(since?: string): Promise<TillWaveSale[]> {
    const url = new URL("sales", this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`);
    if (since !== undefined) url.searchParams.set("since", since);
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`TillWave responded with ${res.status}`);
    const data: unknown = await res.json();
    const list: unknown = Array.isArray(data) ? data : (data as { sales?: unknown } | null)?.sales;
    if (!Array.isArray(list)) throw new Error("unexpected TillWave response");
    return (list as RawSale[]).map((s) => ({
      id: String(s.id),
      merchantId: String(s.merchantId),
      amountCents: s.amount as number,
      time: String(s.time),
    }));
  }
}
