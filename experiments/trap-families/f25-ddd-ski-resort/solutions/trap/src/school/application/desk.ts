import type { LessonView } from '../contracts';
import type { LessonBook } from '../domain/LessonBook';
import { Lesson, SchoolRefusal } from '../domain/Lesson';
import type { PupilCards, Wallet } from './ports';

export interface SchoolParts {
  readonly lessons: LessonBook;
  readonly cards: PupilCards;
  readonly wallet: Wallet;
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
  lesson.enrol(passNo);
  try {
    parts.wallet.pay(passNo, lesson.price, `lesson ${lessonId}`);
  } catch {
    lesson.decline(passNo);
  }
  parts.lessons.put(lesson, []);
}

export function callOffLesson(parts: SchoolParts, lessonId: string): void {
  const lesson = mustFind(parts, lessonId);
  const paid = lesson.callOff();
  parts.lessons.put(lesson, []);
  for (const p of paid) if (lesson.price > 0) parts.wallet.load(p, lesson.price);
}

/** Gives up every place the pass holds; returns the total to give back. */
export function releasePlacesOf(parts: SchoolParts, passNo: string): number {
  let total = 0;
  for (const id of parts.lessons.idsWithPass(passNo)) {
    const lesson = mustFind(parts, id);
    total += lesson.release(passNo);
    parts.lessons.put(lesson, []);
  }
  return total;
}

export function withdrawPupil(parts: SchoolParts, passNo: string, lessonId: string): void {
  const lesson = mustFind(parts, lessonId);
  parts.lessons.put(lesson, lesson.withdraw(passNo));
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
