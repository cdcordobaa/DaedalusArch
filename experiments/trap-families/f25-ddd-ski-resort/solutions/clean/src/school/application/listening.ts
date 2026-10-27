import type { LessonPaidNotice, LessonPaymentRefusedNotice, PassBlockedNotice, PassIssuedNotice } from '../../passes';
import type { SchoolParts } from './desk';
import type { PupilCards } from './ports';

/** A new pass was issued: the school notes the holder's name for its lists. */
export function onPassIssued(cards: PupilCards, notice: PassIssuedNotice): void {
  cards.remember(notice.passNo, notice.holder);
}

/** The pass answered a payment request. */
export function onPaymentAnswer(parts: SchoolParts, n: LessonPaidNotice | LessonPaymentRefusedNotice): void {
  const lesson = parts.lessons.find(n.lessonId);
  if (lesson !== undefined) parts.lessons.put(lesson, lesson.settle(n.passNo, n.kind === 'LessonPaid'));
}

/** A pass was reported lost: every place it holds is given up. */
export function onPassBlocked(parts: SchoolParts, n: PassBlockedNotice): void {
  for (const id of parts.lessons.idsWithPass(n.passNo)) {
    const lesson = parts.lessons.find(id);
    if (lesson !== undefined) parts.lessons.put(lesson, lesson.giveBack(n.passNo));
  }
}
