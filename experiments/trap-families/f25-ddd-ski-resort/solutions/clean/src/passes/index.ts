import type { LessonCalledOffNotice, PlaceGivenBackNotice, PlaceReservedNotice } from '../school';
import type { Reactions } from '../wiring/mailroom';
import { issuePass, loadCredit, payAtKiosk, reportLost, viewPass } from './application/office';
import { onLessonCalledOff, onPlaceGivenBack, onPlaceReserved } from './application/reacting';
import type { PassView } from './contracts';
import type { PassBook } from './domain/PassBook';

export type { LessonPaidNotice, LessonPaymentRefusedNotice, PassBlockedNotice, PassIssuedNotice, PassView } from './contracts';

/** The pass office, as the rest of the resort may use it. */
export function openPassOffice(book: PassBook) {
  return {
    issue: (holder: string, credit: number): string => issuePass(book, holder, credit),
    load: (passNo: string, euros: number): void => loadCredit(book, passNo, euros),
    pay: (passNo: string, euros: number, what: string): void => payAtKiosk(book, passNo, euros, what),
    reportLost: (passNo: string): void => reportLost(book, passNo),
    pass: (passNo: string): PassView | undefined => viewPass(book, passNo),
  };
}

export type PassOffice = ReturnType<typeof openPassOffice>;

/** What the pass office does when something happens elsewhere in the resort. */
export function passReactions(book: PassBook): Reactions {
  return {
    PlaceReserved: (h) => onPlaceReserved(book, h as PlaceReservedNotice),
    LessonCalledOff: (h) => onLessonCalledOff(book, h as LessonCalledOffNotice),
    PlaceGivenBack: (h) => onPlaceGivenBack(book, h as PlaceGivenBackNotice),
  };
}
