import { Amount } from '../../../../shared-kernel/Amount';
import type { BackerStanding } from './BackerStanding';

/** Campaigns' own rule: how much one backer may pledge on one campaign, given the standing they hold. */
const LIMIT_BY_STANDING: Record<Exclude<BackerStanding, 'blocked'>, Amount> = {
  trusted: Amount.ofUnits(5000),
  established: Amount.ofUnits(1000),
  newcomer: Amount.ofUnits(250),
};

export class PledgeCap {
  private constructor(
    readonly standing: BackerStanding,
    readonly limit: Amount,
  ) {}

  static forStanding(standing: BackerStanding): PledgeCap {
    return new PledgeCap(standing, standing === 'blocked' ? Amount.ZERO : LIMIT_BY_STANDING[standing]);
  }

  get blocked(): boolean {
    return this.standing === 'blocked';
  }
}
