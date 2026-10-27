/**
 * F14 behaviour tests: black-box through `createApp` (the seed's entry), with the geopin-sdk stand-in driven through
 * globalThis.__geopinFake. They must pass on the clean and the trap end state; feature cases fail on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface DeliveryView { orderId: string; status: string; address?: string; latitude?: number; longitude?: number; unverified?: boolean; reason?: string }
interface PickupPointView { id: string; name: string; address: string; latitude: number; longitude: number }
interface App {
  schedule(orderId: string, street: string, postcode: string, city: string, country: string): Promise<DeliveryView>;
  pickupPoints(postcode: string, country: string): Promise<PickupPointView[]>;
}
interface Fake { down: boolean; calls: { op: string; request?: unknown }[]; geocode: (r: unknown) => unknown; places: (r: unknown) => unknown }
interface GeocodeRequest { query: { addressLine: string; postalCode?: string; locality?: string }; countryIso: string }
const match = (precision: string, confidence: number, formattedAddress: string, countryIso = 'NL', lat = 52.3731, lng = 4.8922) => ({
  formattedAddress, precision, confidence, location: { lat, lng }, components: { countryIso },
});
const answer = (...matches: unknown[]) => () => ({ matches });
const DAM = match('ROOFTOP', 0.97, 'Dam 1, 1012 JS Amsterdam, Netherlands');

const setup = (createApp: (o?: Record<string, unknown>) => unknown, fake: Partial<Fake> = {}): { app: App; fake: Fake } => {
  process.env.GEOPIN_API_KEY = 'test-key';
  const f: Fake = { down: false, calls: [], geocode: answer(DAM), places: () => [], ...fake };
  (globalThis as { __geopinFake?: Fake }).__geopinFake = f;
  return { app: createApp() as App, fake: f };
};
const geocodeRequests = (f: Fake): GeocodeRequest[] => f.calls.filter((c) => c.op === 'geocode').map((c) => c.request as GeocodeRequest);
const NOT_FOUND = 'We could not find this address.';

export const cases: TestCase[] = [
  {
    name: 'pickup points near a postcode are listed with their position',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, {
        places: () => [{ placeId: 'pl_1', displayName: 'Locker Dam', formattedAddress: 'Dam 5, 1012 JS Amsterdam', location: { lat: 52.373, lng: 4.893 } }],
      });
      assert.deepEqual(await app.pickupPoints('1012 JS', 'NL'), [{ id: 'pl_1', name: 'Locker Dam', address: 'Dam 5, 1012 JS Amsterdam', latitude: 52.373, longitude: 4.893 }]);
      const req = fake.calls.find((c) => c.op === 'places')?.request as { postalCode: string; countryIso: string; category: string };
      assert.deepEqual([req.postalCode, req.countryIso, req.category], ['1012 JS', 'NL', 'PARCEL_LOCKER']);
    },
  },
  {
    name: 'a badly formed address is refused before anything else',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      await assert.rejects(app.schedule('A-1', 'Dam 1', '1012 JS', 'Amsterdam', 'Netherlands'), /two-letter/);
      await assert.rejects(app.schedule('A-1', ' ', '1012 JS', 'Amsterdam', 'NL'), /street and city/);
      await assert.rejects(app.schedule('A-1', 'Dam 1', '#', 'Amsterdam', 'NL'), /postcode/);
      assert.equal(geocodeRequests(fake).length, 0);
    },
  },
  {
    name: 'an address Geopin finds precisely is scheduled with its spelling and position',
    kind: 'feature',
    step: 'verify-address',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, { geocode: answer(DAM, match('STREET', 0.9, 'Damrak, Amsterdam')) });
      const v = await app.schedule('A-1', 'dam 1', '1012JS', 'amsterdam', 'NL');
      assert.deepEqual([v.orderId, v.status, v.address, v.latitude, v.longitude], ['A-1', 'scheduled', 'Dam 1, 1012 JS Amsterdam, Netherlands', 52.3731, 4.8922]);
      const reqs = geocodeRequests(fake);
      assert.equal(reqs.length, 1);
      assert.deepEqual([reqs[0]!.query.addressLine, reqs[0]!.query.postalCode, reqs[0]!.query.locality, reqs[0]!.countryIso], ['dam 1', '1012JS', 'amsterdam', 'NL']);
      const street = await setup(createApp, { geocode: answer(match('STREET', 0.8, 'Kalverstraat, 1012 Amsterdam, Netherlands', 'NL', 52.37, 4.89)) }).app.schedule('A-2', 'Kalverstraat 9', '1012 NX', 'Amsterdam', 'NL');
      assert.deepEqual([street.status, street.address, street.latitude, street.longitude], ['scheduled', 'Kalverstraat, 1012 Amsterdam, Netherlands', 52.37, 4.89]);
    },
  },
  {
    name: 'an address Geopin cannot place well enough is rejected',
    kind: 'feature',
    step: 'verify-address',
    run: async (createApp) => {
      const none = await setup(createApp, { geocode: answer() }).app.schedule('B-1', 'Nowhere 1', '9999 ZZ', 'Atlantis', 'NL');
      assert.deepEqual([none.status, none.reason], ['rejected', NOT_FOUND]);
      const unsure = await setup(createApp, { geocode: answer(match('ROOFTOP', 0.79, 'Dam 1, Amsterdam')) }).app.schedule('B-2', 'Dam 1', '1012 JS', 'Amsterdam', 'NL');
      assert.deepEqual([unsure.status, unsure.reason], ['rejected', NOT_FOUND]);
      const town = await setup(createApp, { geocode: answer(match('LOCALITY', 0.99, 'Amsterdam, Netherlands'), DAM) }).app.schedule('B-3', 'Somewhere', '1012 JS', 'Amsterdam', 'NL');
      assert.equal(town.status, 'rejected');
      assert.equal(town.latitude, undefined);
    },
  },
  {
    name: 'when the geocoder is down the delivery is scheduled to the typed address, marked unverified',
    kind: 'feature',
    step: 'geocoder-down',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, { down: true });
      const v = await app.schedule('C-1', 'Dam 1', '1012 JS', 'Amsterdam', 'NL');
      assert.equal(geocodeRequests(fake).length, 1, 'Geopin is tried first');
      assert.deepEqual([v.status, v.address, v.unverified, v.latitude, v.longitude], ['scheduled', 'Dam 1, 1012 JS Amsterdam, NL', true, undefined, undefined]);
      await assert.rejects(app.schedule('C-2', 'Dam 1', '1012 JS', 'Amsterdam', 'nl'), /two-letter/);
    },
  },
  {
    name: 'deliveries checked by the geocoder are not marked unverified',
    kind: 'feature',
    step: 'geocoder-down',
    run: async (createApp) => {
      const { app } = setup(createApp);
      const v = await app.schedule('C-3', 'Dam 1', '1012 JS', 'Amsterdam', 'NL');
      assert.deepEqual([v.status, v.unverified], ['scheduled', false]);
    },
  },
  {
    name: 'a rejected address tells the customer what to fix',
    kind: 'feature',
    step: 'rejections',
    run: async (createApp) => {
      const expect = async (matches: unknown[], reason: string): Promise<void> => {
        const v = await setup(createApp, { geocode: answer(...matches) }).app.schedule('D-1', 'Dam 1', '1012 JS', 'Amsterdam', 'NL');
        assert.deepEqual([v.status, v.reason], ['rejected', reason]);
      };
      await expect([match('ROOFTOP', 0.98, 'Grote Markt 1, 1000 Brussel, Belgium', 'BE')], 'This address is in another country.');
      await expect([match('LOCALITY', 0.95, 'Amsterdam, Netherlands')], 'Please add your street and house number.');
      await expect([match('POSTCODE', 0.9, '1012 JS Amsterdam, Netherlands')], 'Please add your street and house number.');
      await expect([match('STREET', 0.5, 'Dam, Amsterdam, Netherlands')], NOT_FOUND);
      await expect([], NOT_FOUND);
    },
  },
];
