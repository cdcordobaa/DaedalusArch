import { StudioError } from '../../../domain/errors/StudioError';
import type { PunchCard } from '../../../domain/model/studio/PunchCard';
import type { PunchCards } from '../../ports/out/studio/PunchCards';

/** Ten-session cards for open studio evenings. */
export class PunchCardService {
  constructor(private readonly cards: PunchCards) {}

  async issue(memberId: string, expires: string): Promise<PunchCard> {
    const card: PunchCard = { memberId, sessionsLeft: 10, expires };
    await this.cards.write(card);
    return card;
  }

  async punch(memberId: string, today: string): Promise<number> {
    const card = await this.cards.byMember(memberId);
    if (card === undefined) throw new StudioError('member ' + memberId + ' has no card');
    if (today > card.expires) throw new StudioError('the card expired on ' + card.expires);
    if (card.sessionsLeft === 0) throw new StudioError('the card is used up');
    await this.cards.write({ ...card, sessionsLeft: card.sessionsLeft - 1 });
    return card.sessionsLeft - 1;
  }
}
