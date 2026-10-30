import type { RatingsDesk } from 'ratingsdesk-sdk';
import { EntryError, RegistrationBusyError } from '../../../domain/errors/EntryError';
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
      const seconds = Number(result.headers['x-ratelimit-reset']);
      throw new RegistrationBusyError(Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 20);
    }
    throw new EntryError(d.description);
  }
}
