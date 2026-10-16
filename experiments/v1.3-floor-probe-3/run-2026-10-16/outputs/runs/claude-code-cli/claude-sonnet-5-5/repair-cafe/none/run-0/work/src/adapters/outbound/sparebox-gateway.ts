import { PlacedPartOrder, SpareBoxGateway, SparePart } from "../../application/ports";

export interface SpareBoxOptions {
  baseUrl: string;
  apiKey: string;
}

export class SpareBoxHttpGateway implements SpareBoxGateway {
  constructor(private readonly opts: SpareBoxOptions) {}

  private async call(path: string, init: RequestInit): Promise<unknown> {
    const res = await fetch(`${this.opts.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.opts.apiKey}`,
      },
    });
    if (!res.ok) throw new Error(`SpareBox responded with HTTP ${res.status}`);
    return res.json();
  }

  async searchParts(brand: string, model: string): Promise<SparePart[]> {
    const query = new URLSearchParams({ brand, model });
    const data = (await this.call(`/parts?${query.toString()}`, { method: "GET" })) as
      { parts?: Array<{ id: string; name: string; price: number }> };
    return (data.parts ?? []).map((p) => ({ partId: String(p.id), name: p.name, price: Number(p.price) }));
  }

  async placeOrder(partId: string): Promise<PlacedPartOrder> {
    const data = (await this.call("/orders", {
      method: "POST",
      body: JSON.stringify({ partId }),
    })) as { orderNumber: string; expectedDeliveryDate: string };
    return { orderNumber: String(data.orderNumber), expectedDelivery: data.expectedDeliveryDate };
  }
}

/** Used when no SpareBox credentials are configured (local development). */
export class UnconfiguredSpareBoxGateway implements SpareBoxGateway {
  async searchParts(): Promise<SparePart[]> { throw new Error("SpareBox is not configured"); }
  async placeOrder(): Promise<PlacedPartOrder> { throw new Error("SpareBox is not configured"); }
}
