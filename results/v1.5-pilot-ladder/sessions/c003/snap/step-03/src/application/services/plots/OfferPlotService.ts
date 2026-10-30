import { GardenError } from '../../../domain/errors/GardenError';
import { QueueOrder } from '../../../domain/services/QueueOrder';
import type { OfferPlot, OfferView, ReminderView } from '../../ports/in/WaitingList';
import type { Applicants } from '../../ports/out/storage/Applicants';
import type { Offers } from '../../ports/out/storage/Offers';
import type { PlotOfferNotifier } from '../../ports/out/mail/PlotOfferNotifier';
import type { Noticeboard } from '../../ports/out/storage/Noticeboard';

export class OfferPlotService implements OfferPlot {
  constructor(
    private readonly applicants: Applicants,
    private readonly offers: Offers,
    private readonly board: Noticeboard,
    private readonly notifier: PlotOfferNotifier,
    private readonly queueOrder: QueueOrder = new QueueOrder(),
  ) {}

  async remind(plotId: string): Promise<ReminderView> {
    const offer = await this.offers.get(plotId);
    if (offer === null) throw new GardenError('Plot ' + plotId + ' has not been offered to anyone.');
    await this.notifier.remind(offer.applicant.name, offer.applicant.email, plotId);
    return { plotId, offeredTo: offer.applicant.name, reminded: true };
  }

  async offer(plotId: string): Promise<OfferView> {
    if (!/^[0-9]{1,3}[a-z]?$/.test(plotId)) throw new GardenError('a plot number looks like 12 or 12b');
    const waiting = await this.applicants.all();
    if (waiting.length === 0) throw new GardenError('Nobody is waiting.');
    // Rejected addresses go to the end of the list and are not tried again for this plot.
    const rejected = new Set<string>();
    for (;;) {
      const next = this.queueOrder.next(waiting.filter((a) => !rejected.has(a.email)));
      if (next === undefined) return { plotId, offeredTo: null, email: 'rejected', emailedTo: '' };
      const email = await this.notifier.notify(next.name, next.email, plotId);
      if (email === 'rejected') {
        rejected.add(next.email);
        await this.applicants.moveToEnd(next.email);
        continue;
      }
      await this.applicants.remove(next.email);
      await this.offers.save({ plotId, applicant: next });
      await this.board.post('Plot ' + plotId + ' offered to ' + next.name);
      return { plotId, offeredTo: next.name, email, emailedTo: next.email };
    }
  }
}
