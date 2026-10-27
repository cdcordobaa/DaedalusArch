import type { LessonCalledOffNotice, PlaceGivenBackNotice, PlaceReservedNotice } from '../../school';
import type { PassBook } from '../domain/PassBook';

/** A lesson asks to be paid from the pupil's pass. */
export function onPlaceReserved(book: PassBook, n: PlaceReservedNotice): void {
  const pass = book.find(n.passNo);
  if (pass !== undefined) book.put(pass, pass.payForLesson(n.lessonId, n.price));
}

/** A lesson was called off for weather: each paying pupil gets the price back. */
export function onLessonCalledOff(book: PassBook, n: LessonCalledOffNotice): void {
  for (const r of n.refunds) {
    const pass = book.find(r.passNo);
    if (pass !== undefined) book.put(pass, pass.refundLesson(n.lessonId, r.euros, `lesson ${n.lessonId} called off`));
  }
}

/** A place was given up for a lost pass: its price goes back on the credit. */
export function onPlaceGivenBack(book: PassBook, n: PlaceGivenBackNotice): void {
  const pass = book.find(n.passNo);
  if (pass !== undefined) book.put(pass, pass.refundLesson(n.lessonId, n.euros, `lesson ${n.lessonId} given up`));
}
