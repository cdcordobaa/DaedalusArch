import { SignatureServiceBusy } from '../../domain/errors/SignatureServiceBusy';
import type { RemindSigners } from '../ports/in/RemindSigners';
import type { AgreementStore } from '../ports/out/AgreementStore';
import type { SignatureRequests } from '../ports/out/SignatureRequests';

export class ReminderService implements RemindSigners {
  constructor(
    private readonly store: AgreementStore,
    private readonly signatures: SignatureRequests,
  ) {}

  async sendReminders(now: Date): Promise<string[]> {
    const reminded: string[] = [];
    for (const agreement of await this.store.all()) {
      const signing = agreement.signing;
      if (signing === undefined || !agreement.isReminderDue(now)) continue;
      const waitingOn = await this.signatures.signersYetToSign(signing.ref);
      if (waitingOn.length === 0) continue;
      try {
        await this.signatures.remind(signing.ref, waitingOn);
      } catch (e) {
        if (e instanceof SignatureServiceBusy) continue;
        throw e;
      }
      agreement.markReminded(now);
      await this.store.save(agreement);
      reminded.push(agreement.id);
    }
    return reminded;
  }
}
