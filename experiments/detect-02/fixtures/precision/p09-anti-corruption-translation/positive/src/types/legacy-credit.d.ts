declare module 'legacy-credit' {
  export interface LegacyApplicant {
    readonly CUST_NO: string;
    readonly FULL_NAME: string;
    readonly ORDERS_12M: number;
  }
  export interface LegacyVerdict {
    readonly CODE: 'A' | 'D' | 'R';
  }
  export class LegacyCreditClient {
    score(applicant: LegacyApplicant, amountMinor: number): LegacyVerdict;
  }
}
