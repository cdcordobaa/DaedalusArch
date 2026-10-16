import { DonatedProduct } from '../../domain/donation';
import { DonationFeed } from '../../application/ports';

interface FreshLinkProduct {
  product_code: string;
  name: string;
  quantity: number;
  best_before: string;
}

export class FreshLinkClient implements DonationFeed {
  constructor(private readonly baseUrl: string, private readonly token: string) {}

  async donatedOn(date: string): Promise<DonatedProduct[]> {
    const res = await fetch(`${this.baseUrl}/donations?date=${encodeURIComponent(date)}`, {
      headers: { authorization: `Bearer ${this.token}`, accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`FreshLink returned ${res.status}`);
    const body = (await res.json()) as { products: FreshLinkProduct[] };
    return body.products.map((p) => ({
      productCode: p.product_code,
      name: p.name,
      quantity: Number(p.quantity),
      bestBefore: p.best_before.slice(0, 10),
    }));
  }
}
