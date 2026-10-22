import { FastshipClient } from 'fastship-sdk';
import { ShippingController } from '../adapters/inbound/http/ShippingController';
import { FastshipRateAdapter } from '../adapters/outbound/fastship/FastshipRateAdapter';
import { FastshipTrackingAdapter } from '../adapters/outbound/fastship/FastshipTrackingAdapter';
import { QuoteShipmentService } from '../application/services/QuoteShipmentService';
import { TrackShipmentService } from '../application/services/TrackShipmentService';

/** Composition root. The Fastship key comes from FASTSHIP_API_KEY. */
export function createApp() {
  const fastship = new FastshipClient({ apiKey: process.env.FASTSHIP_API_KEY ?? '' });
  const quotes = new QuoteShipmentService(new FastshipRateAdapter(fastship, 'EUR'));
  const tracking = new TrackShipmentService(new FastshipTrackingAdapter(fastship));
  const http = new ShippingController(quotes, tracking);
  return {
    quote: (from: string, to: string, weightGrams: number) => quotes.quote({ from, to, weightGrams }),
    track: (trackingNumber: string) => tracking.track(trackingNumber),
    http,
  };
}
