import { CoverageDecision } from './coverage';
import { RefillClosedError } from './errors';

export type RefillState = 'requested' | 'ready-to-fill' | 'awaiting-authorisation' | 'declined';

export class Refill {
  private state: RefillState = 'requested';
  private claimRef: string | null = null;
  private copayCents = 0;

  constructor(
    readonly id: string,
    readonly patientId: string,
    readonly coverageId: string,
    readonly productCode: string,
    readonly quantity: number,
  ) {}

  applyCoverage(decision: CoverageDecision): void {
    if (this.state !== 'requested') throw new RefillClosedError(this.id);
    this.claimRef = decision.claimRef;
    this.copayCents = decision.verdict === 'covered' ? decision.copayCents : 0;
    this.state = decision.verdict === 'covered' ? 'ready-to-fill' : decision.verdict === 'prior-auth' ? 'awaiting-authorisation' : 'declined';
  }

  get currentState(): RefillState {
    return this.state;
  }

  get claimReference(): string | null {
    return this.claimRef;
  }

  get patientCopayCents(): number {
    return this.copayCents;
  }
}
