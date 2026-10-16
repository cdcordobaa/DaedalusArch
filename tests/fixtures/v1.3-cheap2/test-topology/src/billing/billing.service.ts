export interface BillingResult {
  readonly total: number;
}

/** PLANTED P1: a co-located spec exists (FF-CV05 is satisfied) but it only imports a type. */
export class BillingService {
  bill(n: number): BillingResult {
    return { total: n * 2 };
  }
}
