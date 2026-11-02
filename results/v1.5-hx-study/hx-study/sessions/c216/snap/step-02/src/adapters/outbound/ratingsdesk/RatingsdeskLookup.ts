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
    if (result.status === 429) {
      const raw = result.headers['x-ratelimit-reset'];
      const secs = raw !== undefined && raw.trim() !== '' ? Math.ceil(Number(raw)) : NaN;
      throw new RegistrationBusyError(Number.isFinite(secs) && secs >= 0 ? secs : 20);
    }
    if (result.status === 404 && d.error === 'unknown_player') {
      throw new EntryError('No player with this federation id.', 404);
    }
    throw new EntryError(d.description);
  }
}
