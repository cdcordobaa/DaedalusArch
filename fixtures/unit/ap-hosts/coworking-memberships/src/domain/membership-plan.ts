import { DomainError } from './domain-error';
import { Money } from './money';

export const PLAN_CODES = ['flex', 'fixed-desk', 'office', 'virtual'] as const;

export type PlanCode = (typeof PLAN_CODES)[number];

export function isPlanCode(value: string): boolean {
  return (PLAN_CODES as readonly string[]).includes(value);
}

export class UnknownPlanError extends DomainError {
  constructor(code: string) {
    super('UNKNOWN_PLAN', `No membership plan "${code}" (plans: ${PLAN_CODES.join(', ')})`);
  }
}

/** Price list and allowances of a plan, as published on the website. */
export class MembershipPlan {
  readonly code: PlanCode;
  readonly monthlyPrice: Money;
  readonly deskDaysPerMonth: number;
  readonly meetingCreditsPerMonth: number;

  constructor(code: PlanCode, monthlyPrice: Money, deskDaysPerMonth: number, meetingCreditsPerMonth: number) {
    this.code = code;
    this.monthlyPrice = monthlyPrice;
    this.deskDaysPerMonth = deskDaysPerMonth;
    this.meetingCreditsPerMonth = meetingCreditsPerMonth;
  }

  static byCode(code: string): MembershipPlan {
    switch (code) {
      case 'flex':
        return new MembershipPlan(code, Money.euros(190), 10, 4);
      case 'fixed-desk':
        return new MembershipPlan(code, Money.euros(320), 31, 8);
      case 'office':
        return new MembershipPlan(code, Money.euros(890), 31, 20);
      case 'virtual':
        return new MembershipPlan(code, Money.euros(45), 0, 2);
      default:
        throw new UnknownPlanError(code);
    }
  }

  includesDesk(): boolean {
    return this.deskDaysPerMonth > 0;
  }
}
