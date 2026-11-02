import type { RatingsDesk } from 'ratingsdesk-sdk';
import { EntryError, RegistrationBusyError, UnknownPlayerError } from '../../../domain/errors/EntryError';
import type { PlayerRecord } from '../../../domain/model/PlayerRecord';
import type { RatingLookup } from '../../../application/ports/out/RatingLookup';

export class RatingsdeskLookup implements RatingLookup {
  constructor(private readonly desk: RatingsDesk) {}

  async find(federationId: string): Promise<PlayerRecord> {
    const result = await this.desk.players.lookup(federationId);
    const d = result.data;
    if ('fedId' in d) return { federationId: d.fedId, name: d.fullName, rating: d.standardRating };
    if (result.status === 404 && d.error === 'unknown_player') throw new UnknownPlayerError();
    if (result.status === 429) {
      const secs = Number.parseInt(result.headers['x-ratelimit-reset'] ?? '', 10);
      throw new RegistrationBusyError(Number.isFinite(secs) && secs >= 0 ? secs : 20);
    }
    throw new EntryError(d.description);
  }
}
