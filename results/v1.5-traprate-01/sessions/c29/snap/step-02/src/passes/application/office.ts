import type { PassView } from '../contracts';
import type { PassBook } from '../domain/PassBook';
import { PassRefusal, SkiPass } from '../domain/SkiPass';

const mustFind = (book: PassBook, passNo: string): SkiPass => {
  const pass = book.find(passNo);
  if (pass === undefined) throw new PassRefusal(`no pass ${passNo}`);
  return pass;
};

export function issuePass(book: PassBook, holder: string, credit: number): string {
  const { pass, said } = SkiPass.issue(book.newNumber(), holder, credit);
  book.put(pass, said);
  return pass.passNo;
}

/** The ticket office loads credit onto a pass. */
export function loadCredit(book: PassBook, passNo: string, euros: number): void {
  const pass = mustFind(book, passNo);
  book.put(pass, pass.load(euros, 'ticket office'));
}

/** A kiosk on the mountain (food, rentals) takes payment from a pass. */
export function payAtKiosk(book: PassBook, passNo: string, euros: number, what: string): void {
  const pass = mustFind(book, passNo);
  book.put(pass, pass.pay(euros, what));
}

/** A lesson fee is asked of the pass; the answer is written as a happening. */
export function takeLessonFee(book: PassBook, passNo: string, euros: number, lessonId: string): void {
  const pass = mustFind(book, passNo);
  book.put(pass, pass.payFee(euros, lessonId));
}

/** A paid lesson place was given up: the fee goes back onto the pass. */
export function refundLessonFee(book: PassBook, passNo: string, euros: number, lessonId: string): void {
  const pass = mustFind(book, passNo);
  book.put(pass, pass.load(euros, `refund lesson ${lessonId}`));
}

export function viewPass(book: PassBook, passNo: string): PassView | undefined {
  const pass = book.find(passNo);
  return pass === undefined ? undefined : { passNo: pass.passNo, holder: pass.holder, credit: pass.credit, status: pass.status };
}
