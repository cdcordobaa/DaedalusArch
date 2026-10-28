import type { PassIssuedNotice } from '../../passes';
import type { PupilCards } from './ports';

/** A new pass was issued: the school notes the holder's name for its lists. */
export function onPassIssued(cards: PupilCards, notice: PassIssuedNotice): void {
  cards.remember(notice.passNo, notice.holder);
}
