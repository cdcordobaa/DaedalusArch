import type { PostbirdClient } from 'postbird-sdk';
import type { PlotOfferNotifier } from '../../../application/ports/out/PlotOfferNotifier';

export class PostbirdPlotOfferAdapter implements PlotOfferNotifier {
  constructor(private readonly client: PostbirdClient) {}

  async notify(name: string, email: string, plotId: string): Promise<void> {
    await this.client.sendTemplate({ to: email, templateId: 'plot-offer', variables: { name, plot: plotId } });
  }
}
