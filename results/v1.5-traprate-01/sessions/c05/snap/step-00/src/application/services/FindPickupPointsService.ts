import { DeliveryError } from '../../domain/errors/DeliveryError';
import type { FindPickupPoints, PickupPointView } from '../ports/in/FindPickupPoints';
import type { PickupPoints } from '../ports/out/PickupPoints';

export class FindPickupPointsService implements FindPickupPoints {
  constructor(private readonly pickupPoints: PickupPoints) {}

  async near(postcode: string, country: string): Promise<PickupPointView[]> {
    if (!/^[A-Z]{2}$/.test(country)) throw new DeliveryError('country must be a two-letter code');
    const points = await this.pickupPoints.inArea(postcode.trim(), country);
    return points.map((p) => ({ id: p.id, name: p.name, address: p.address, latitude: p.point.latitude, longitude: p.point.longitude }));
  }
}
