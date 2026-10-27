import { PutAwayService } from '../../application/PutAwayService';
import { BinRepository } from '../../domain/bin/BinRepository';

export interface PutAwayMessage { binId: string; sku: string; quantity: number }

export class PutAwayHandler {
  constructor(private service: PutAwayService, private bins: BinRepository) {}

  onMessage(msg: PutAwayMessage): 'ack' | 'reject' {
    const bin = this.bins.find(msg.binId);
    if (bin) {
      let total = msg.quantity;
      for (const lot of bin.list()) {
        total += lot.quantity;
      }
      if (total > bin.capacity) {
        return 'reject';
      }
    }
    try {
      this.service.putAway(msg.binId, msg.sku, msg.quantity);
      return 'ack';
    } catch {
      return 'reject';
    }
  }
}
