import type { RatingsDesk } from 'ratingsdesk-sdk';
import { EntryError } from '../../../domain/errors/EntryError';
import { RegistrationBusyError } from '../../../domain/errors/RegistrationBusyError';
import { UnknownPlayerError } from '../../../domain/errors/UnknownPlayerError';
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
      const secs = Number(result.headers['x-ratelimit-reset']);
      const hasValue = result.headers['x-ratelimit-reset'] !== undefined && String(result.headers['x-ratelimit-reset']).trim() !== '';
      throw new RegistrationBusyError(hasValue && Number.isFinite(secs) && secs >= 0 ? Math.ceil(secs) : 20);
    }
    throw new EntryError(d.description);
  }
}
