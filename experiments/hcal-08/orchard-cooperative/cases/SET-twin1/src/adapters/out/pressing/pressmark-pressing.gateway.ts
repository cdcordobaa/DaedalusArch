import { FruitGrade, PressmarkClient, PressmarkError } from 'pressmark-sdk';
import { PressingOrder, PressingServicePort } from '../../../application/ports/out/pressing-service.port';
import { PressingUnavailableError } from '../../../domain/errors';
import { LotUse, PressingTicket } from '../../../domain/pressing';

export class PressmarkPressingGateway implements PressingServicePort {
  private readonly client: PressmarkClient;

  constructor(apiKey: string) {
    this.client = new PressmarkClient({ api_key: apiKey });
  }

  async book(order: PressingOrder): Promise<PressingTicket> {
    try {
      const res = await this.client.book({
        cultivar_code: order.variety.toUpperCase(),
        bins: order.crates,
        delivery_date: order.deliveredOn,
        brix: 0,
      });
      return { runRef: res.run_id, accepted: res.run_state !== 'SPOILED', use: this.toUse(res.grade) };
    } catch (e) {
      if (e instanceof PressmarkError) throw new PressingUnavailableError(`press house unavailable: ${e.message}`);
      throw e;
    }
  }

  private toUse(grade: FruitGrade): LotUse {
    if (grade === 'PRIME') return 'table';
    return grade === 'JUICING' ? 'press' : 'compost';
  }
}
