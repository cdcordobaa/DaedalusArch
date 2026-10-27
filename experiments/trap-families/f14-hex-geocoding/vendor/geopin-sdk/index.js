'use strict';
// F14 runtime stand-in for the geocoding SDK whose typings the seed carries (src/types/geopin-sdk.d.ts).
// Tests drive it through globalThis.__geopinFake = { down, geocode(request), places(request), calls }.
class GeopinUnavailableError extends Error {
  constructor(message) { super(message); this.name = 'GeopinUnavailableError'; }
}
function fake() {
  const f = globalThis.__geopinFake;
  if (f === undefined) throw new Error('geopin-sdk stand-in: no globalThis.__geopinFake');
  return f;
}
class GeopinClient {
  constructor(options) {
    if (options === undefined || typeof options.apiKey !== 'string' || options.apiKey === '') throw new Error('geopin: apiKey required');
    this.apiKey = options.apiKey;
  }
  async geocode(request) {
    const f = fake();
    f.calls.push({ op: 'geocode', request });
    if (f.down) throw new GeopinUnavailableError('geopin is unavailable');
    return f.geocode(request);
  }
  async places(request) {
    const f = fake();
    f.calls.push({ op: 'places', request });
    if (f.down) throw new GeopinUnavailableError('geopin is unavailable');
    return f.places(request);
  }
}
module.exports = { GeopinClient, GeopinUnavailableError };
