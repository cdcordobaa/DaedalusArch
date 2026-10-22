import type { TrackingStep } from '../../domain/model/TrackingStep';
import type { TrackShipment } from '../ports/in/TrackShipment';
import type { TrackingPort } from '../ports/out/TrackingPort';

const STATUS: Record<string, TrackingStep['status']> = {
  PICKED_UP: 'picked up',
  IN_TRANSIT: 'in transit',
  OUT_FOR_DELIVERY: 'out for delivery',
  DELIVERED: 'delivered',
};

export class TrackShipmentService implements TrackShipment {
  constructor(private readonly tracking: TrackingPort) {}

  async track(trackingNumber: string): Promise<TrackingStep[]> {
    const events = await this.tracking.events(trackingNumber);
    return events.map((e) => ({ status: STATUS[e.code] ?? 'in transit', at: e.timestamp }));
  }
}
