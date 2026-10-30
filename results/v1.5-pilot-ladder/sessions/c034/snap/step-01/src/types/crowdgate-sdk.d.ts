// Typings of the Crowdgate capacity SDK (crowdgate-sdk 1.8), as shipped by the vendor. Every call answers the
// HTTP reply as is: status, headers (lower-case names) and the JSON body.
declare module 'crowdgate-sdk' {
  export interface CrowdgateReply<T> {
    status: number;
    headers: Record<string, string>;
    body: T;
  }
  export interface CrowdgateHold {
    holdId: string;
    slot: string;
    visitors: number;
  }
  export interface CrowdgateProblem {
    error: 'slot_full' | 'rate_limited' | 'bad_request';
    message: string;
  }
  export interface CrowdgateSlot {
    slot: string;
    capacity: number;
    left: number;
  }
  export class CrowdgateClient {
    constructor(options: { apiKey: string });
    holdEntry(request: { slot: string; visitors: number }): Promise<CrowdgateReply<CrowdgateHold | CrowdgateProblem>>;
    slots(day: string): Promise<CrowdgateReply<CrowdgateSlot[]>>;
  }
}
