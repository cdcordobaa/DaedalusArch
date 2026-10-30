import type { RatingsDesk } from 'ratingsdesk-sdk';
import { EntryError } from '../../../domain/errors/EntryError';
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
    throw new EntryError(d.description);
  }
}
