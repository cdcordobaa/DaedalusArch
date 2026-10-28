import type { GeopinClient } from 'geopin-sdk';
import type { PickupPoints } from '../../../application/ports/out/PickupPoints';
import type { PickupPoint } from '../../../domain/model/PickupPoint';

export class GeopinPickupPointsAdapter implements PickupPoints {
  constructor(private readonly client: GeopinClient) {}

  async inArea(postcode: string, country: string): Promise<PickupPoint[]> {
    const places = await this.client.places({ postalCode: postcode, countryIso: country, category: 'PARCEL_LOCKER' });
    return places.map((p) => ({ id: p.placeId, name: p.displayName, address: p.formattedAddress, point: { latitude: p.location.lat, longitude: p.location.lng } }));
  }
}
