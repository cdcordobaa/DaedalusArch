import { chargeIfCovered, issuePass, loadCredit, payAtKiosk, refund, reportLost, viewPass } from './application/office';
import type { PassView } from './contracts';
import type { PassBook } from './domain/PassBook';

export type { PassBlockedNotice, PassIssuedNotice, PassView } from './contracts';

/** The pass office, as the rest of the resort may use it. */
export function openPassOffice(book: PassBook) {
  return {
    issue: (holder: string, credit: number): string => issuePass(book, holder, credit),
    load: (passNo: string, euros: number): void => loadCredit(book, passNo, euros),
    pay: (passNo: string, euros: number, what: string): void => payAtKiosk(book, passNo, euros, what),
    charge: (passNo: string, euros: number, what: string): boolean => chargeIfCovered(book, passNo, euros, what),
    refund: (passNo: string, euros: number, what: string): void => refund(book, passNo, euros, what),
    reportLost: (passNo: string): void => reportLost(book, passNo),
    pass: (passNo: string): PassView | undefined => viewPass(book, passNo),
  };
}

export type PassOffice = ReturnType<typeof openPassOffice>;
