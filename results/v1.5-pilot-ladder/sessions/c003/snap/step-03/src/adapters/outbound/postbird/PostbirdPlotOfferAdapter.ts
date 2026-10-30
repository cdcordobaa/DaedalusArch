import type { PostbirdClient } from 'postbird-sdk';
import type { PlotOfferNotifier } from '../../../application/ports/out/mail/PlotOfferNotifier';

export class PostbirdPlotOfferAdapter implements PlotOfferNotifier {
  constructor(private readonly client: PostbirdClient) {}

  async notify(name: string, email: string, plotId: string): Promise<string> {
    const receipt = await this.client.sendTemplate({ to: email, templateId: 'plot-offer', variables: { name, plot: plotId } });
    return receipt.state;
  }

  async remind(name: string, email: string, plotId: string): Promise<string> {
    const receipt = await this.client.sendTemplate({ to: email, templateId: 'plot-offer-reminder', variables: { name, plot: plotId } });
    return receipt.state;
  }
}
