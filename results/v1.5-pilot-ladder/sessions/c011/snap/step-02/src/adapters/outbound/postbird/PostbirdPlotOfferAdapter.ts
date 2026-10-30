import type { PostbirdClient } from 'postbird-sdk';
import type { Applicant } from '../../../domain/model/Applicant';
import type { PlotOfferNotifier } from '../../../application/ports/out/PlotOfferNotifier';

export class PostbirdPlotOfferAdapter implements PlotOfferNotifier {
  constructor(private readonly client: PostbirdClient) {}

  async notify(applicant: Applicant, plotId: string): Promise<boolean> {
    const receipt = await this.client.sendTemplate({
      to: applicant.email,
      templateId: 'plot-offer',
      variables: { name: applicant.name, plot: plotId },
    });
    return receipt.state !== 'rejected';
  }
}
