'use strict';
// HX study set part B, hxpb4: runtime stand-in for the player-rating SDK whose typings the seed carries
// (src/types/ratingsdesk-sdk.d.ts). Tests drive it through
// globalThis.__ratingsdeskFake = { players: { [fedId]: { fullName, standardRating } }, throttle: { reset } | undefined, calls: [] }.
function fake() {
  const f = globalThis.__ratingsdeskFake;
  if (f === undefined) throw new Error('ratingsdesk-sdk stand-in: no globalThis.__ratingsdeskFake');
  return f;
}
class RatingsDesk {
  constructor(credentials) {
    if (credentials === undefined || typeof credentials.clientId !== 'string' || credentials.clientId === '') throw new Error('ratingsdesk: clientId required');
    if (typeof credentials.secret !== 'string' || credentials.secret === '') throw new Error('ratingsdesk: secret required');
    this.clientId = credentials.clientId;
    this.players = {
      lookup: async (fedId) => {
        const f = fake();
        f.calls.push({ op: 'players.lookup', fedId });
        if (f.throttle !== undefined) {
          const headers = f.throttle.reset !== undefined ? { 'x-ratelimit-reset': f.throttle.reset } : {};
          return { status: 429, headers, data: { error: 'rate_limited', description: 'Too many lookups' } };
        }
        const p = f.players[fedId];
        if (p === undefined) return { status: 404, headers: {}, data: { error: 'unknown_player', description: 'No player ' + fedId } };
        return { status: 200, headers: { etag: 'W/"' + fedId + '"' }, data: { fedId, fullName: p.fullName, standardRating: p.standardRating, rapidRating: null, federation: 'NED' } };
      },
    };
  }
}
module.exports = { RatingsDesk };
