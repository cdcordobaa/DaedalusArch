import type { PlayerRecord } from '../../../domain/model/PlayerRecord';

/** Finds a player's official rating, in the congress's own terms. */
export interface RatingLookup {
  find(federationId: string): Promise<PlayerRecord>;
}
