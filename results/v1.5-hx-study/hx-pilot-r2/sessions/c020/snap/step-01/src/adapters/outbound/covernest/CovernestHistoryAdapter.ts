import type { CovernestClient } from 'covernest-sdk';
import type { RiskBand } from '../../../application/ports/in/CheckHirer';
import type { ClaimsHistory } from '../../../application/ports/out/ClaimsHistory';

export class CovernestHistoryAdapter implements ClaimsHistory {
  constructor(private readonly client: CovernestClient) {}

  async bandOf(hirerRef: string): Promise<RiskBand> {
    const h = await this.client.claimsHistory(hirerRef);
    switch (h.band) {
      case 'NO_CLAIMS': return 'none';
      case 'ONE_CLAIM': return 'low';
      default: return 'high';
    }
  }
}
