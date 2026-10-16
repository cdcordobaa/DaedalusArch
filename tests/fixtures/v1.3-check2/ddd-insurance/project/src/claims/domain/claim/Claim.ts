import { DomainError } from '../../../shared-kernel/DomainError';
import { Money } from '../../../shared-kernel/Money';

export type ClaimStatus = 'open' | 'settled' | 'declined';

export class Claim {
  id: string;
  policyNumber: string;
  peril: string;
  incidentOn: Date;
  claimedCents: number;
  status: ClaimStatus;
  paidCents: number;

  constructor(id: string, policyNumber: string, peril: string, incidentOn: Date, claimedCents: number, status: ClaimStatus = 'open', paidCents = 0) {
    this.id = id;
    this.policyNumber = policyNumber;
    this.peril = peril;
    this.incidentOn = incidentOn;
    this.claimedCents = claimedCents;
    this.status = status;
    this.paidCents = paidCents;
  }

  settle(limit: Money, deductible: Money): Money {
    if (this.status !== 'open') throw new DomainError('rejected', `Claim ${this.id} is ${this.status}`);
    const payout = new Money(this.claimedCents).minus(deductible).min(limit);
    this.status = 'settled';
    this.paidCents = payout.cents;
    return payout;
  }

  decline(): void {
    if (this.status !== 'open') throw new DomainError('rejected', `Claim ${this.id} is ${this.status}`);
    this.status = 'declined';
  }
}
