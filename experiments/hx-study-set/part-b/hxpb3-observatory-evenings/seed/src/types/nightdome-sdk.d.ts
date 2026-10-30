// Typings of the Nightdome seat-booking SDK (nightdome-sdk 0.9), as shipped by the vendor. Every call answers the
// raw HTTP exchange: the status, the headers (lower-case names) and the parsed JSON body.
declare module 'nightdome-sdk' {
  export interface NightdomeResponse<B> {
    status: number;
    headers: Record<string, string>;
    json: B;
  }
  export interface SeatHold {
    holdRef: string;
    evening: string;
    seats: number;
  }
  export interface NightdomeFault {
    code: 'dome_full' | 'clouded_out' | 'invalid';
    detail: string;
  }
  export interface EveningInfo {
    evening: string;
    seatsFree: number;
    telescope: string;
  }
  export class NightdomeClient {
    constructor(opts: { apiKey: string; observatory: string });
    reserveSeats(input: { evening: string; seats: number; children: number }): Promise<NightdomeResponse<SeatHold | NightdomeFault>>;
    evenings(month: string): Promise<NightdomeResponse<EveningInfo[]>>;
  }
}
