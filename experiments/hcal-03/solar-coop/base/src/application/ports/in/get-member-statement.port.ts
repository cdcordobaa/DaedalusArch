import { Statement } from '../../../domain/statement';

export interface GetMemberStatement {
  execute(memberId: string): Promise<Statement>;
}
