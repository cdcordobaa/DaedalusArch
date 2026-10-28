import { Statement } from '../../../domain/statement';

export interface StatementArchive {
  store(memberId: string, statement: Statement): Promise<void>;
}
