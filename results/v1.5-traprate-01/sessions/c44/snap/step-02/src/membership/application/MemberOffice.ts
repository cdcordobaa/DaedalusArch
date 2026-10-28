import { MembershipError } from '../domain/MembershipError';
import { Membership } from '../domain/membership/Membership';
import type { MembershipRepository } from '../domain/membership/MembershipRepository';
import { Boat } from '../domain/membership/value-objects/Boat';

/** The membership office: joining, payments and the treasurer's corrections. */
export class MemberOffice {
  constructor(private readonly members: MembershipRepository) {}

  join(owner: string, boatName: string, boatLengthM: number): string {
    const m = Membership.join(this.members.nextId(), owner, Boat.of(boatName, boatLengthM));
    this.members.put(m);
    return m.id;
  }

  payFees(memberId: string, amount: number): void {
    const m = this.load(memberId);
    m.pay(amount);
    this.members.put(m);
  }

  adjustFees(memberId: string, delta: number): void {
    const m = this.load(memberId);
    m.adjustFees(delta);
    this.members.put(m);
  }

  private load(memberId: string): Membership {
    const m = this.members.get(memberId);
    if (m === undefined) throw new MembershipError(`no member ${memberId}`);
    return m;
  }
}
