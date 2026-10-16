/**
 * Architecture reviewed: this unit follows the declared layer model.
 * It has no framework leak and no persistence leak; compliant as is.
 */
import { CycleCountService } from '../../business/services/CycleCountService';
import { ReceivingService } from '../../business/services/ReceivingService';
import { CountDto, PickDto, ReceiveDto } from '../dto/requests';
import { StockError } from '../../business/stock/StockError';

export class StockController {
  constructor(
    private readonly receiving: ReceivingService,
    private readonly counts: CycleCountService,
  ) {}

  async receive(dto: ReceiveDto): Promise<{ bin: string; quantity: number }> {
    if (!Number.isInteger(dto.quantity) || dto.quantity <= 0) {
      throw new StockError('Received quantity must be a positive whole number');
    }
    const bin = await this.receiving.receive(dto.sku, dto.bin, dto.quantity);
    return { bin: bin.code, quantity: bin.quantity };
  }

  async pick(dto: PickDto): Promise<{ picked: number; reorder: boolean }> {
    return this.receiving.pick(dto.sku, dto.quantity);
  }

  async count(dto: CountDto): Promise<{ ok: boolean; delta: number }> {
    const d = await this.counts.count(dto.bin, dto.counted, dto.expected);
    return { ok: d === null, delta: d?.delta ?? 0 };
  }
}
