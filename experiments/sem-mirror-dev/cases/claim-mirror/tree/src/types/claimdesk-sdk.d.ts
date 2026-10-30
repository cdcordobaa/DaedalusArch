declare module 'claimdesk-sdk' {
  /** Workflow state of a ClaimDesk claim file. */
  export type ClaimState = 'CLM_OPEN' | 'CLM_ASSESS' | 'CLM_APPROVED' | 'CLM_DENIED' | 'CLM_PAID';

  export interface ClaimFile {
    claim_ref: string;
    state: ClaimState;
    amount_cents: number;
  }

  export class ClaimDeskClient {
    constructor(options: { token: string });
    file(ref: string): Promise<ClaimFile>;
  }
}
