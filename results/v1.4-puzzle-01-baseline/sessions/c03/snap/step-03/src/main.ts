import { LoanService } from './business/services/LoanService';
import { MemberService } from './business/services/MemberService';
import { Database } from './persistence/Database';
import { LoanGateway } from './persistence/LoanGateway';
import { MemberGateway } from './persistence/MemberGateway';
import { LibraryController } from './presentation/LibraryController';

export interface AppOptions {
  /** Today's date as YYYY-MM-DD; defaults to the system date. */
  readonly today?: () => string;
}

/** Composition root: returns the HTTP controller. */
export function createApp(options: AppOptions = {}): LibraryController {
  const today = options.today ?? (() => new Date().toISOString().slice(0, 10));
  const db = new Database();
  const members = new MemberService(new MemberGateway(db));
  const loans = new LoanService(new LoanGateway(db), members);
  return new LibraryController(members, loans, today);
}
