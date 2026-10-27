import { blockPass, issuePass, loadCredit, payAtKiosk, viewPass } from './application/office';
import type { PassView } from './contracts';
import type { PassBook } from './domain/PassBook';

export type { PassIssuedNotice, PassView } from './contracts';

/** The pass office, as the rest of the resort may use it. */
export function openPassOffice(book: PassBook) {
  return {
    issue: (holder: string, credit: number): string => issuePass(book, holder, credit),
    load: (passNo: string, euros: number): void => loadCredit(book, passNo, euros),
    pay: (passNo: string, euros: number, what: string): void => payAtKiosk(book, passNo, euros, what),
    block: (passNo: string): boolean => blockPass(book, passNo),
    pass: (passNo: string): PassView | undefined => viewPass(book, passNo),
  };
}

export type PassOffice = ReturnType<typeof openPassOffice>;
