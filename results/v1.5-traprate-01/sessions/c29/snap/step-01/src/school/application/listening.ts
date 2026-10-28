import type { PassIssuedNotice } from '../../passes';
import type { FeeDeclinedNotice, FeePaidNotice } from '../../passes';
import type { LessonBook } from '../domain/LessonBook';
import type { PupilCards } from './ports';

/** The pass office took the lesson fee: the pupil's place is paid. */
export function onFeePaid(lessons: LessonBook, notice: FeePaidNotice): void {
  const lesson = lessons.find(notice.lessonId);
  if (lesson !== undefined) lessons.put(lesson, lesson.feePaid(notice.passNo));
}

/** The pass could not pay: the place is given back. */
export function onFeeDeclined(lessons: LessonBook, notice: FeeDeclinedNotice): void {
  const lesson = lessons.find(notice.lessonId);
  if (lesson !== undefined) lessons.put(lesson, lesson.feeDeclined(notice.passNo));
}

/** A new pass was issued: the school notes the holder's name for its lists. */
export function onPassIssued(cards: PupilCards, notice: PassIssuedNotice): void {
  cards.remember(notice.passNo, notice.holder);
}
