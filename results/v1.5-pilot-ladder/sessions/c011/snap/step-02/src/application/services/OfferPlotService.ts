import { GardenError } from '../../domain/errors/GardenError';
import type { OfferPlot, OfferView } from '../ports/in/WaitingList';
import type { Applicants } from '../ports/out/Applicants';
import type { Offers } from '../ports/out/Offers';
import type { Noticeboard } from '../ports/out/Noticeboard';
import type { PlotOfferNotifier } from '../ports/out/PlotOfferNotifier';

export class OfferPlotService implements OfferPlot {
  constructor(
    private readonly applicants: Applicants,
    private readonly offers: Offers,
    private readonly board: Noticeboard,
    private readonly notifier: PlotOfferNotifier,
  ) {}

  async offer(plotId: string): Promise<OfferView> {
    if (!/^[0-9]{1,3}[a-z]?$/.test(plotId)) throw new GardenError('a plot number looks like 12 or 12b');
    const waiting = await this.applicants.all();
    if (waiting.length === 0) throw new GardenError('Nobody is waiting.');
    for (const next of waiting) {
      if (!(await this.notifier.notify(next, plotId))) {
        await this.applicants.moveToEnd(next.email);
        continue;
      }
      await this.applicants.remove(next.email);
      await this.offers.save({ plotId, applicant: next });
      await this.board.post('Plot ' + plotId + ' offered to ' + next.name);
      return { plotId, offeredTo: next.name };
    }
    return { plotId, offeredTo: null };
  }
}
