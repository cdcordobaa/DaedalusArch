// Typings of the Ratingsdesk player-rating SDK (ratingsdesk-sdk 4.1), as shipped by the vendor. Each lookup answers
// the HTTP result as received: status, headers (lower-case names) and the decoded data.
declare module 'ratingsdesk-sdk' {
  export interface RdHttpResult<T> {
    status: number;
    headers: Record<string, string>;
    data: T;
  }
  export interface RdPlayer {
    fedId: string;
    fullName: string;
    standardRating: number;
    rapidRating: number | null;
    federation: string;
  }
  export interface RdError {
    error: 'unknown_player' | 'rate_limited' | 'bad_request';
    description: string;
  }
  export interface RdPlayers {
    lookup(fedId: string): Promise<RdHttpResult<RdPlayer | RdError>>;
  }
  export class RatingsDesk {
    constructor(credentials: { clientId: string; secret: string });
    readonly players: RdPlayers;
  }
}
