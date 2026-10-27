import type { SigningOutcome } from '../../domain/model/SigningOutcome';
import type { RecordSigningOutcome } from '../ports/in/RecordSigningOutcome';
import type { AgreementStore } from '../ports/out/AgreementStore';

/** Outcomes may arrive twice, late or for a signing we never sent; only the current signing's first outcome counts. */
export class SigningOutcomeService implements RecordSigningOutcome {
  constructor(private readonly store: AgreementStore) {}

  async record(signingRef: string, outcome: SigningOutcome): Promise<void> {
    const agreement = await this.store.findBySigning(signingRef);
    if (agreement === undefined || !agreement.isAwaiting(signingRef)) return;
    agreement.record(signingRef, outcome);
    await this.store.save(agreement);
  }
}
