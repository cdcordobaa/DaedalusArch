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
      throw Object.assign(new EntryError('No player with this federation id.'), { statusCode: 404 });
    }
    if (result.status === 429) {
      const secs = Number(result.headers['x-ratelimit-reset']);
      const retryAfter = Number.isFinite(secs) && secs > 0 && result.headers['x-ratelimit-reset']?.trim() !== '' ? Math.ceil(secs) : 20;
      throw Object.assign(new EntryError('Registration is busy, please try again shortly.'), {
        statusCode: 503,
        headers: { 'Retry-After': String(retryAfter) },
      });
    }
    throw new EntryError(d.description);
  }
}
