import { TrackingPort } from './ports/out/tracking.port';

export class TrackingNumberQuery {
  constructor(private readonly tracking: TrackingPort) {}

  async isMoving(trackingNumber: string): Promise<boolean> {
    const u = await this.tracking.latest(trackingNumber);
    return u.stage === 'Moving' || u.stage === 'OutForDelivery';
  }
}
