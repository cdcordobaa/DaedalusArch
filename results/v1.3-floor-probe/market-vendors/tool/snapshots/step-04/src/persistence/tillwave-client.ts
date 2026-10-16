export interface TillWaveSale {
  id: string;
  merchant_id: string;
  amount_cents: number;
  created_at: string;
}

/** TillWave HTTP API: sales since a cursor. */
export const tillwaveClient = {
  baseUrl: process.env.TILLWAVE_URL ?? 'https://api.tillwave.example',
  apiKey: process.env.TILLWAVE_API_KEY ?? '',

  async salesSince(cursor: string | undefined): Promise<{ sales: TillWaveSale[]; cursor: string | undefined }> {
    const url = new URL('/v1/sales', this.baseUrl);
    if (cursor) url.searchParams.set('since', cursor);
    const res = await fetch(url, { headers: { authorization: `Bearer ${this.apiKey}` } });
    if (!res.ok) throw new Error(`TillWave ${res.status}`);
    const body = (await res.json()) as { data: TillWaveSale[]; next_cursor?: string };
    return { sales: body.data, cursor: body.next_cursor ?? cursor };
  },
};
