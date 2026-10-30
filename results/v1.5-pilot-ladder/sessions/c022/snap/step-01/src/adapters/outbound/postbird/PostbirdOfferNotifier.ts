import type { PostbirdClient } from 'postbird-sdk';
import type { Applicant } from '../../../domain/model/Applicant';
import type { OfferNotice, OfferNotifier } from '../../../application/ports/out/mail/OfferNotifier';

export class PostbirdOfferNotifier implements OfferNotifier {
  constructor(private readonly client: PostbirdClient) {}

  async notify(applicant: Applicant, plotId: string): Promise<OfferNotice> {
    const receipt = await this.client.sendTemplate({
      to: applicant.email,
      templateId: 'plot-offer',
      variables: { name: applicant.name, plot: plotId },
    });
    return { email: applicant.email, status: receipt.state };
  }
}
