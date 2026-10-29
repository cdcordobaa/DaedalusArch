import type { PostbirdClient } from 'postbird-sdk';
import type { Applicant } from '../../../domain/model/Applicant';
import type { OfferLetters } from '../../../application/ports/out/OfferLetters';

export class PostbirdOfferLettersAdapter implements OfferLetters {
  constructor(private readonly client: PostbirdClient) {}

  async offer(to: Applicant, plotId: string): Promise<boolean> {
    const receipt = await this.client.sendTemplate({ to: to.email, templateId: 'plot-offer', variables: { name: to.name, plot: plotId } });
    return receipt.state !== 'rejected';
  }
}
