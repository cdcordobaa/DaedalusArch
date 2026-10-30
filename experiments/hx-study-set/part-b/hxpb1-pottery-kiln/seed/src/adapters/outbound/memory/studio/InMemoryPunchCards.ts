import type { PunchCard } from '../../../../domain/model/studio/PunchCard';
import type { PunchCards } from '../../../../application/ports/out/studio/PunchCards';

export class InMemoryPunchCards implements PunchCards {
  private cards: PunchCard[] = [];

  async byMember(memberId: string): Promise<PunchCard | undefined> {
    return this.cards.find((c) => c.memberId === memberId);
  }

  async write(card: PunchCard): Promise<void> {
    this.cards = [...this.cards.filter((c) => c.memberId !== card.memberId), card];
  }
}
