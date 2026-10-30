import type { GiftjarClient } from 'giftjar-sdk';
import type { SeatPayment } from '../../../domain/model/SeatPayment';
import type { Redemptions } from '../../../application/ports/out/Redemptions';

export class GiftjarRedemptionsAdapter implements Redemptions {
  constructor(private readonly client: GiftjarClient) {}

  async take(code: string, amount: number, flightId: string): Promise<SeatPayment> {
    const r = await this.client.redeem({ code, amount_cents: Math.round(amount * 100), reference: flightId });
    if (r.result === 'accepted') return { paid: true };
    return { paid: false, due: r.result === 'insufficient_balance' ? r.short_by_cents / 100 : amount };
  }
}
