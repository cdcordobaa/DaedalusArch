import type { LessonView } from '../contracts';
import type { LessonBook } from '../domain/LessonBook';
import { Lesson, SchoolRefusal } from '../domain/Lesson';
import type { Payments, PupilCards } from './ports';

export interface SchoolParts {
  readonly lessons: LessonBook;
  readonly cards: PupilCards;
  readonly payments: Payments;
}

const mustFind = (parts: SchoolParts, lessonId: string): Lesson => {
  const lesson = parts.lessons.find(lessonId);
  if (lesson === undefined) throw new SchoolRefusal(`no lesson ${lessonId}`);
  return lesson;
};

export function offerLesson(parts: SchoolParts, title: string, day: string, places: number, price: number): string {
  const { lesson, said } = Lesson.offer(parts.lessons.newId(), title, day, places, price);
  parts.lessons.put(lesson, said);
  return lesson.lessonId;
}

export function enrolPupil(parts: SchoolParts, passNo: string, lessonId: string): void {
  if (parts.cards.nameOf(passNo) === undefined) throw new SchoolRefusal(`no pass ${passNo}`);
  const lesson = mustFind(parts, lessonId);
  // Checks (duplicate, full) come first, so nobody is charged for a place they cannot get.
  lesson.assertCanEnrol(passNo);
  const paid = parts.payments.charge(passNo, lesson.price, `lesson ${lesson.lessonId}`);
  parts.lessons.put(lesson, lesson.enrol(passNo, paid));
}

export function withdrawPupil(parts: SchoolParts, passNo: string, lessonId: string): void {
  const lesson = mustFind(parts, lessonId);
  const said = lesson.withdraw(passNo);
  parts.lessons.put(lesson, said);
  parts.payments.refund(passNo, lesson.price, `lesson ${lesson.lessonId} withdrawn`);
}

export function callOffLesson(parts: SchoolParts, lessonId: string): void {
  const lesson = mustFind(parts, lessonId);
  const payers = lesson.callOff();
  if (payers === undefined) return;
  parts.lessons.put(lesson, []);
  for (const passNo of payers) parts.payments.refund(passNo, lesson.price, `lesson ${lesson.lessonId} called off`);
}

export function viewLesson(parts: SchoolParts, lessonId: string): LessonView | undefined {
  const l = parts.lessons.find(lessonId);
  return l === undefined ? undefined : { lessonId: l.lessonId, title: l.title, day: l.day, price: l.price, places: l.places, placesLeft: l.placesLeft(), status: l.status };
}

export function placeOf(parts: SchoolParts, lessonId: string, passNo: string): string | undefined {
  return parts.lessons.find(lessonId)?.placeOf(passNo);
}

/** Names of the pupils who hold a place, for the instructor's list. */
export function pupilList(parts: SchoolParts, lessonId: string): string[] {
  return (parts.lessons.find(lessonId)?.holders() ?? []).map((p) => parts.cards.nameOf(p) ?? p);
}
