import { RouteKitClient } from 'routekit-sdk';
import { RideCommand } from '../adapters/inbound/cli/RideCommand';
import { InMemoryOpenPools } from '../adapters/outbound/memory/InMemoryOpenPools';
import { RouteKitPickupAreas } from '../adapters/outbound/routekit/RouteKitPickupAreas';
import { RouteKitRoutePlanner } from '../adapters/outbound/routekit/RouteKitRoutePlanner';
import { RequestRideService } from '../application/RequestRideService';

/** Composition root. The RouteKit key comes from ROUTEKIT_API_KEY. */
export function createApp() {
  const routekit = new RouteKitClient({ apiKey: process.env.ROUTEKIT_API_KEY ?? '' });
  const rides = new RequestRideService(new RouteKitPickupAreas(routekit), new InMemoryOpenPools(), new RouteKitRoutePlanner(routekit));
  const cli = new RideCommand(rides);
  return {
    requestRide: (rider: string, pickup: [number, number], dropoff: [number, number]) => rides.request({ rider, pickup, dropoff }),
    cli,
  };
}
