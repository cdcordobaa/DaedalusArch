import type { RatingsDesk } from 'ratingsdesk-sdk';
import { EntryError } from '../../../domain/errors/EntryError';
import { RegistrationBusyError } from '../../../domain/errors/RegistrationBusyError';
import { UnknownPlayerError } from '../../../domain/errors/UnknownPlayerError';
import type { PlayerRecord } from '../../../domain/model/PlayerRecord';
import type { RatingLookup } from '../../../application/ports/out/RatingLookup';

const DEFAULT_RETRY_SECONDS = 20;

function retryAfter(raw: string | undefined): number {
  const n = raw === undefined || raw.trim() === '' ? NaN : Math.ceil(Number(raw));
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_RETRY_SECONDS;
}

export class RatingsdeskLookup implements RatingLookup {
  constructor(private readonly desk: RatingsDesk) {}

  async find(federationId: string): Promise<PlayerRecord> {
    const result = await this.desk.players.lookup(federationId);
    const d = result.data;
    if ('fedId' in d) return { federationId: d.fedId, name: d.fullName, rating: d.standardRating };
    if (result.status === 404 && d.error === 'unknown_player') throw new UnknownPlayerError();
    if (result.status === 429) throw new RegistrationBusyError(retryAfter(result.headers['x-ratelimit-reset']));
    throw new EntryError(d.description);
  }
}
