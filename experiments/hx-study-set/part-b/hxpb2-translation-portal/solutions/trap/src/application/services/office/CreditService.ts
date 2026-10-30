import { BureauError } from '../../../domain/errors/BureauError';
import { CreditLine } from '../../../domain/model/office/CreditLine';
import type { CreditLedger } from '../../ports/out/office/CreditLedger';

/** Credit for business clients who order often. */
export class CreditService {
  constructor(private readonly ledger: CreditLedger) {}

  async open(clientId: string, limitEuros: number): Promise<CreditLine> {
    const line = new CreditLine(clientId, limitEuros, 0);
    await this.ledger.keep(line);
    return line;
  }

  async charge(clientId: string, euros: number): Promise<number> {
    const line = await this.ledger.line(clientId);
    if (line === undefined) throw new BureauError(clientId + ' pays up front');
    if (!line.canTake(euros)) throw new BureauError('the credit limit of ' + clientId + ' is reached');
    const next = line.charge(euros);
    await this.ledger.keep(next);
    return next.limitEuros - next.owedEuros;
  }
}
