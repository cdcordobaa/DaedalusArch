import type { RouteKitClient } from 'routekit-sdk';
import type { PickupAreas } from '../../../application/outbound/PickupAreas';
import type { AreaStatus } from '../../../domain/AreaStatus';
import type { Location } from '../../../domain/Location';

/** RouteKit's zones at a place, read as what we may do there. */
export class RouteKitPickupAreas implements PickupAreas {
  constructor(private readonly client: RouteKitClient) {}

  async statusAt(place: Location): Promise<AreaStatus> {
    const { zones } = await this.client.zonesAt({ lat: place.latitude, lng: place.longitude });
    if (!zones.some((z) => z.kind === 'SERVICE')) return 'outside';
    return zones.some((z) => z.kind === 'NO_PICKUP') ? 'drop-off only' : 'served';
  }
}
