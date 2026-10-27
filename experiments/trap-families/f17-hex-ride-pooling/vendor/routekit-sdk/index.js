'use strict';
// F17 runtime stand-in for the maps and routing vendor SDK whose typings the seed carries (src/types/routekit-sdk.d.ts).
// Tests drive it through globalThis.__routekitFake = { calls, routeError, retryAfterSec, leg(a, b), zones(point) }.
class RouteKitError extends Error {
  constructor(message, status) { super(message); this.name = 'RouteKitError'; this.status = status; }
}
class RouteKitQuotaError extends RouteKitError {
  constructor(message, retryAfterSec, quotaName) {
    super(message, 429);
    this.name = 'RouteKitQuotaError';
    this.retryAfterSec = retryAfterSec;
    this.quotaName = quotaName;
  }
}
function fake() {
  const f = globalThis.__routekitFake;
  if (f === undefined) throw new Error('routekit-sdk stand-in: no globalThis.__routekitFake');
  return f;
}
class RouteKitClient {
  constructor(options) {
    if (options === undefined || typeof options.apiKey !== 'string' || options.apiKey === '') throw new Error('routekit: apiKey required');
    this.apiKey = options.apiKey;
  }
  async route(request) {
    const f = fake();
    f.calls.push({ op: 'route', request });
    if (f.routeError === 'quota') throw new RouteKitQuotaError('daily route quota exhausted', f.retryAfterSec, 'routes-per-day');
    if (f.routeError === 'server') throw new RouteKitError('routekit internal error', 503);
    const wp = request.waypoints;
    if (!Array.isArray(wp) || wp.length < 2) throw new RouteKitError('a route needs at least two waypoints', 400);
    const legs = [];
    for (let i = 0; i + 1 < wp.length; i += 1) legs.push(f.leg(wp[i], wp[i + 1]));
    return {
      legs,
      totalDurationSec: legs.reduce((s, l) => s + l.durationSec, 0),
      totalDistanceM: legs.reduce((s, l) => s + l.distanceM, 0),
      trafficModel: 'TYPICAL',
    };
  }
  async zonesAt(point) {
    const f = fake();
    f.calls.push({ op: 'zones', request: point });
    return { zones: f.zones(point) };
  }
}
module.exports = { RouteKitClient, RouteKitError, RouteKitQuotaError };
