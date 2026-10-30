import { GiftjarClient } from 'giftjar-sdk';
import { LaunchFieldController } from '../adapters/inbound/http/LaunchFieldController';
import { InMemoryFlights } from '../adapters/outbound/memory/InMemoryFlights';
import { GiftjarVouchersAdapter } from '../adapters/outbound/giftjar/GiftjarVouchersAdapter';
import { GiftjarExtensionsAdapter } from '../adapters/outbound/giftjar/GiftjarExtensionsAdapter';
import { GiftjarPaymentsAdapter } from '../adapters/outbound/giftjar/GiftjarPaymentsAdapter';
import { FlightService } from '../application/services/FlightService';
import { VoucherDeskService } from '../application/services/VoucherDeskService';

/** Composition root. The Giftjar key comes from GIFTJAR_MERCHANT_KEY. The returned object is the app. */
export function createApp() {
  const giftjar = new GiftjarClient({ merchantKey: process.env.GIFTJAR_MERCHANT_KEY ?? '' });
  const vouchers = new GiftjarVouchersAdapter(giftjar);
  const flights = new FlightService(new InMemoryFlights(), vouchers, new GiftjarPaymentsAdapter(giftjar));
  const http = new LaunchFieldController(flights, new VoucherDeskService(vouchers, new GiftjarExtensionsAdapter(giftjar)));
  return {
    schedule: async (flightId: string, day: string) => (await http.postFlight({ flightId, day })).body,
    requestSeat: async (flightId: string, passenger: string, voucherCode: string) => (await http.postSeat(flightId, { passenger, voucherCode })).body,
    board: async (flightId: string, passenger: string) => (await http.postBoarding(flightId, { passenger })).body,
    manifest: async (flightId: string) => (await http.getManifest(flightId)).body,
    voucherLine: async (code: string) => (await http.getVoucherLine(code)).body,
    extendVoucher: async (code: string) => (await http.postExtension(code)).body,
    http,
  };
}
