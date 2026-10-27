import { PutAwayService } from '../../application/PutAwayService';

export interface PutAwayMessage { binId: string; sku: string; quantity: number }

export class PutAwayHandler {
  constructor(private service: PutAwayService) {}

  onMessage(msg: PutAwayMessage): 'ack' | 'reject' {
    try {
      this.service.putAway(msg.binId, msg.sku, msg.quantity);
      return 'ack';
    } catch {
      return 'reject';
    }
  }
}
