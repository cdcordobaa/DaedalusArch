import { ClaimFilesPort } from './ports/out/claim-files.port';
import { OwnerNotifierPort } from './ports/out/owner-notifier.port';

export class ReportClaimUseCase {
  constructor(private readonly files: ClaimFilesPort, private readonly notifier: OwnerNotifierPort) {}

  async execute(ownerId: string, ref: string): Promise<void> {
    const claim = await this.files.claim(ref);
    if (claim.progress === 'denied') {
      await this.notifier.tell(ownerId, 'Your claim was not covered.');
    } else if (['approved', 'paid'].includes(claim.progress)) {
      await this.notifier.tell(ownerId, `We are reimbursing ${String(claim.amountCents / 100)}.`);
    } else if (claim.progress === 'assessing') {
      await this.notifier.tell(ownerId, 'A vet is looking at your claim.');
    }
  }
}
