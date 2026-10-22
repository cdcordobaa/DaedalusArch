import { LegacyCreditClient } from 'legacy-credit';
import type { LegacyApplicant } from 'legacy-credit';
import type { Money } from '../../shared-kernel/Money';
import type { CreditCheck, CreditDecision } from '../application/ports/CreditCheck';
import type { Customer } from '../domain/customer/Customer';

/** Anti-corruption layer: translates our Customer into the legacy bureau's applicant and its verdict code back. */
export class LegacyCreditCheck implements CreditCheck {
  constructor(private readonly client: LegacyCreditClient = new LegacyCreditClient()) {}

  assess(customer: Customer, amount: Money): CreditDecision {
    const applicant: LegacyApplicant = { CUST_NO: customer.id, FULL_NAME: customer.name, ORDERS_12M: customer.purchaseCount };
    const verdict = this.client.score(applicant, amount.cents);
    return verdict.CODE === 'A' ? { approved: true, reason: 'approved' } : { approved: false, reason: verdict.CODE === 'R' ? 'refer' : 'declined' };
  }
}
