import type { LetterView, PlanLetter } from '../ports/in/PlanLetter';
import type { Mandates } from '../ports/out/Mandates';

export class PlanLetterService implements PlanLetter {
  constructor(private readonly mandates: Mandates) {}

  async letter(mandateId: string): Promise<LetterView> {
    const m = await this.mandates.find(mandateId);
    return { mandateId, line: 'Direct debit ' + m.mandateId + ' (' + m.reference + '): ' + m.providerStatus };
  }
}
