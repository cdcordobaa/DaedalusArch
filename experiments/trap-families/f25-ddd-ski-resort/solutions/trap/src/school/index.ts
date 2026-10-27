import type { PassIssuedNotice } from '../passes';
import type { Reactions } from '../wiring/mailroom';
import { callOffLesson, enrolPupil, releasePlacesOf, offerLesson, placeOf, pupilList, viewLesson, withdrawPupil, type SchoolParts } from './application/desk';
import { onPassIssued } from './application/listening';
import type { LessonView } from './contracts';

export type { LessonView } from './contracts';
export type { SchoolParts } from './application/desk';

/** The ski school desk, as the rest of the resort may use it. */
export function openSchool(parts: SchoolParts) {
  return {
    offer: (title: string, day: string, places: number, price: number): string => offerLesson(parts, title, day, places, price),
    enrol: (passNo: string, lessonId: string): void => enrolPupil(parts, passNo, lessonId),
    withdraw: (passNo: string, lessonId: string): void => withdrawPupil(parts, passNo, lessonId),
    callOff: (lessonId: string): void => callOffLesson(parts, lessonId),
    releasePlacesOf: (passNo: string): number => releasePlacesOf(parts, passNo),
    lesson: (lessonId: string): LessonView | undefined => viewLesson(parts, lessonId),
    placeOf: (lessonId: string, passNo: string): string | undefined => placeOf(parts, lessonId, passNo),
    pupils: (lessonId: string): string[] => pupilList(parts, lessonId),
  };
}

/** What the school does when something happens elsewhere in the resort. */
export function schoolReactions(parts: SchoolParts): Reactions {
  return {
    PassIssued: (h) => onPassIssued(parts.cards, h as PassIssuedNotice),
  };
}
