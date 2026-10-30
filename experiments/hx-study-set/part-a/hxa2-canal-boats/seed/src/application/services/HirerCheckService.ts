import type { CheckHirer, HirerView } from '../ports/in/CheckHirer';
import type { ClaimsHistory } from '../ports/out/ClaimsHistory';

export class HirerCheckService implements CheckHirer {
  constructor(private readonly history: ClaimsHistory) {}

  async check(hirerRef: string): Promise<HirerView> {
    const band = await this.history.bandOf(hirerRef);
    return { hirerRef, band, mayHire: band !== 'high' };
  }
}
