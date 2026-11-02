import type { RatingsDesk } from 'ratingsdesk-sdk';
import { EntryError } from '../../../domain/errors/EntryError';
import { RegistrationBusyError } from '../../../domain/errors/RegistrationBusyError';
import type { PlayerRecord } from '../../../domain/model/PlayerRecord';
import type { RatingLookup } from '../../../application/ports/out/RatingLookup';

export class RatingsdeskLookup implements RatingLookup {
  constructor(private readonly desk: RatingsDesk) {}

  async find(federationId: string): Promise<PlayerRecord> {
    const result = await this.desk.players.lookup(federationId);
    const d = result.data;
    if ('fedId' in d) return { federationId: d.fedId, name: d.fullName, rating: d.standardRating };
    if (result.status === 404 && d.error === 'unknown_player') {
      const err = new EntryError('No player with this federation id.');
      (err as EntryError & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    if (result.status === 429) {
      const raw = result.headers['x-ratelimit-reset'];
      const secs = raw === undefined || raw.trim() === '' ? NaN : Number(raw);
      throw new RegistrationBusyError(Number.isFinite(secs) && secs >= 0 ? Math.ceil(secs) : 20);
    }
    throw new EntryError(d.description);
  }
}
