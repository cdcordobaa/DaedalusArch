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
    if (result.status === 429) throw new RegistrationBusyError(retryAfterSeconds(result.headers['x-ratelimit-reset']));
    throw new EntryError(d.description);
  }
}

const DEFAULT_RETRY_AFTER_SECONDS = 20;

function retryAfterSeconds(raw: string | undefined): number {
  const n = raw === undefined || raw.trim() === '' ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.ceil(n) : DEFAULT_RETRY_AFTER_SECONDS;
}
