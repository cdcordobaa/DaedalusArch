import { GeopinClient } from 'geopin-sdk';
import { DeliveryController } from '../adapters/inbound/http/DeliveryController';
import { GeopinAddressLookupAdapter } from '../adapters/outbound/geopin/GeopinAddressLookupAdapter';
import { GeopinPickupPointsAdapter } from '../adapters/outbound/geopin/GeopinPickupPointsAdapter';
import { FindPickupPointsService } from '../application/services/FindPickupPointsService';
import { ScheduleDeliveryService } from '../application/services/ScheduleDeliveryService';

/** Composition root. The Geopin key comes from GEOPIN_API_KEY. */
export function createApp() {
  const geopin = new GeopinClient({ apiKey: process.env.GEOPIN_API_KEY ?? '' });
  const deliveries = new ScheduleDeliveryService(new GeopinAddressLookupAdapter(geopin));
  const pickupPoints = new FindPickupPointsService(new GeopinPickupPointsAdapter(geopin));
  const http = new DeliveryController(deliveries, pickupPoints);
  return {
    schedule: (orderId: string, street: string, postcode: string, city: string, country: string) => deliveries.schedule({ orderId, street, postcode, city, country }),
    pickupPoints: (postcode: string, country: string) => pickupPoints.near(postcode, country),
    http,
  };
}
