import type { RatingsDesk } from 'ratingsdesk-sdk';
import { EntryError } from '../../../domain/errors/EntryError';
import { PlayerUnknown } from '../../../domain/errors/PlayerUnknown';
import { RatingsBusy } from '../../../domain/errors/RatingsBusy';
import type { PlayerRecord } from '../../../domain/model/PlayerRecord';
import type { RatingLookup } from '../../../application/ports/out/RatingLookup';

const DEFAULT_WAIT_SECONDS = 20;

export class RatingsdeskLookup implements RatingLookup {
  constructor(private readonly desk: RatingsDesk) {}

  async find(federationId: string): Promise<PlayerRecord> {
    const result = await this.desk.players.lookup(federationId);
    const d = result.data;
    if ('fedId' in d) return { federationId: d.fedId, name: d.fullName, rating: d.standardRating };
    if (result.status === 404 && d.error === 'unknown_player') throw new PlayerUnknown(federationId);
    if (result.status === 429) {
      const reset = Number(result.headers['x-ratelimit-reset']);
      throw new RatingsBusy(Number.isFinite(reset) && reset > 0 ? reset : DEFAULT_WAIT_SECONDS);
    }
    throw new EntryError(d.description);
  }
}
