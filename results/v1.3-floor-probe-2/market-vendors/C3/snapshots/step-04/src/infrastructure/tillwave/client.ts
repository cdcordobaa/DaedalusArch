import { TillWaveApi, TillWaveSale } from '../../application/ports';

export class TillWaveHttpClient implements TillWaveApi {
  constructor(private readonly baseUrl: string, private readonly token: string) {}

  async salesSince(cursor: string | undefined): Promise<{ sales: TillWaveSale[]; cursor: string }> {
    const url = new URL('/v1/sales', this.baseUrl);
    if (cursor) url.searchParams.set('since', cursor);
    const res = await fetch(url, { headers: { authorization: `Bearer ${this.token}` } });
    if (!res.ok) throw new Error(`TillWave ${res.status}`);
    const body = (await res.json()) as { data: { id: string; merchant_id: string; amount: number; created_at: string }[]; next_cursor: string };
    return {
      sales: body.data.map((d) => ({ saleId: d.id, merchantId: d.merchant_id, amountCents: d.amount, time: d.created_at })),
      cursor: body.next_cursor ?? cursor ?? '',
    };
  }
}
