import { GardenError } from '../../../domain/errors/GardenError';
import { QueueOrder } from '../../../domain/services/QueueOrder';
import type { OfferPlot, OfferView } from '../../ports/in/WaitingList';
import type { Applicants } from '../../ports/out/storage/Applicants';
import type { Offers } from '../../ports/out/storage/Offers';
import type { Noticeboard } from '../../ports/out/storage/Noticeboard';
import type { OfferLetters } from '../../ports/out/mail/OfferLetters';

export class OfferPlotService implements OfferPlot {
  constructor(
    private readonly applicants: Applicants,
    private readonly offers: Offers,
    private readonly board: Noticeboard,
    private readonly letters: OfferLetters,
    private readonly queueOrder: QueueOrder = new QueueOrder(),
  ) {}

  async offer(plotId: string): Promise<OfferView> {
    if (!/^[0-9]{1,3}[a-z]?$/.test(plotId)) throw new GardenError('a plot number looks like 12 or 12b');
    const waiting = await this.applicants.all();
    if (waiting.length === 0) throw new GardenError('Nobody is waiting.');
    for (let tries = 0; tries < waiting.length; tries++) {
      const next = this.queueOrder.next(await this.applicants.all())!;
      const delivered = await this.letters.offer(next, plotId);
      if (!delivered) {
        await this.applicants.moveToEnd(next.email);
        continue;
      }
      await this.applicants.remove(next.email);
      await this.offers.save({ plotId, applicant: next });
      await this.board.post('Plot ' + plotId + ' offered to ' + next.name);
      return { plotId, offeredTo: next.name, email: 'queued' };
    }
    return { plotId, offeredTo: null };
  }

  async remind(plotId: string): Promise<OfferView> {
    const offer = await this.offers.get(plotId);
    if (offer === null) throw new GardenError('plot ' + plotId + ' was not offered');
    await this.letters.remind(offer.applicant, plotId);
    return { plotId, offeredTo: offer.applicant.name, reminded: true };
  }
}
