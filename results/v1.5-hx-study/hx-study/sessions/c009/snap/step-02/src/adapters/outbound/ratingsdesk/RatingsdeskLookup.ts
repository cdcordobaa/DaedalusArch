import type { RatingsDesk } from 'ratingsdesk-sdk';
import { EntryError } from '../../../domain/errors/EntryError';
import type { PlayerRecord } from '../../../domain/model/PlayerRecord';
import type { RatingLookup } from '../../../application/ports/out/RatingLookup';

export class RatingsdeskLookup implements RatingLookup {
  constructor(private readonly desk: RatingsDesk) {}

  async find(federationId: string): Promise<PlayerRecord> {
    const result = await this.desk.players.lookup(federationId);
    const d = result.data;
    if ('fedId' in d) return { federationId: d.fedId, name: d.fullName, rating: d.standardRating };
    if (result.status === 404 && d.error === 'unknown_player') {
      throw new EntryError('No player with this federation id.', 404);
    }
    if (result.status === 429) {
      const raw = result.headers['x-ratelimit-reset'];
      const secs = raw === undefined ? NaN : Number(raw);
      const retry = Number.isFinite(secs) && secs > 0 ? Math.ceil(secs) : 20;
      throw new EntryError('Registration is busy, please try again shortly.', 503, { 'Retry-After': String(retry) });
    }
    throw new EntryError(d.description);
  }
}
