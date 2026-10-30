import { GardenError } from '../../../domain/errors/GardenError';
import { QueueOrder } from '../../../domain/services/QueueOrder';
import type { OfferPlot, OfferView } from '../../ports/in/WaitingList';
import type { Applicants } from '../../ports/out/storage/Applicants';
import type { Offers } from '../../ports/out/storage/Offers';
import type { OfferNotice, OfferNotifier } from '../../ports/out/mail/OfferNotifier';
import type { Noticeboard } from '../../ports/out/storage/Noticeboard';

export class OfferPlotService implements OfferPlot {
  constructor(
    private readonly applicants: Applicants,
    private readonly offers: Offers,
    private readonly board: Noticeboard,
    private readonly notifier: OfferNotifier,
    private readonly queueOrder: QueueOrder = new QueueOrder(),
  ) {}

  async offer(plotId: string): Promise<OfferView> {
    if (!/^[0-9]{1,3}[a-z]?$/.test(plotId)) throw new GardenError('a plot number looks like 12 or 12b');
    const initial = await this.applicants.all();
    if (initial.length === 0) throw new GardenError('Nobody is waiting.');
    const rejected = new Set<string>();
    let last: OfferNotice | undefined;
    for (;;) {
      const waiting = (await this.applicants.all()).filter((a) => !rejected.has(a.email));
      const next = this.queueOrder.next(waiting);
      if (next === undefined) break;
      const notice = await this.notifier.notify(next, plotId);
      if (notice.status === 'rejected') {
        rejected.add(next.email);
        last = notice;
        await this.applicants.moveToEnd(next.email);
        continue;
      }
      await this.applicants.remove(next.email);
      await this.offers.save({ plotId, applicant: next });
      await this.board.post('Plot ' + plotId + ' offered to ' + next.name);
      return { plotId, offeredTo: next.name, email: notice.status, emailedTo: notice.email };
    }
    return { plotId, offeredTo: null, email: last?.status ?? 'rejected', emailedTo: last?.email ?? '' };
  }
}
