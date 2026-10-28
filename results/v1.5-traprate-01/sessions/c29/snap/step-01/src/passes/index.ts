import type { FeeRefundDueNotice, FeeRequestedNotice } from '../school/contracts';
import type { Reactions } from '../wiring/mailroom';
import { issuePass, loadCredit, payAtKiosk, refundLessonFee, takeLessonFee, viewPass } from './application/office';
import type { PassView } from './contracts';
import type { PassBook } from './domain/PassBook';

export type { FeeDeclinedNotice, FeePaidNotice, PassIssuedNotice, PassView } from './contracts';

/** What the pass office does when something happens elsewhere in the resort. */
export function passReactions(book: PassBook): Reactions {
  return {
    FeeRequested: (h) => {
      const n = h as FeeRequestedNotice;
      takeLessonFee(book, n.passNo, n.euros, n.lessonId);
    },
    FeeRefundDue: (h) => {
      const n = h as FeeRefundDueNotice;
      refundLessonFee(book, n.passNo, n.euros, n.lessonId);
    },
  };
}

/** The pass office, as the rest of the resort may use it. */
export function openPassOffice(book: PassBook) {
  return {
    issue: (holder: string, credit: number): string => issuePass(book, holder, credit),
    load: (passNo: string, euros: number): void => loadCredit(book, passNo, euros),
    pay: (passNo: string, euros: number, what: string): void => payAtKiosk(book, passNo, euros, what),
    pass: (passNo: string): PassView | undefined => viewPass(book, passNo),
  };
}

export type PassOffice = ReturnType<typeof openPassOffice>;
