import { InsuranceGateway } from '../../../application/ports/out/insurance-gateway.port';
import { InsuranceQuote } from '../../../domain/insurance-quote';
import { LoanRequest } from '../../../domain/loan-request';
import { Money } from '../../../domain/value-objects';
import { HttpClient } from './http-client';

export class RestInsuranceGateway implements InsuranceGateway {
  constructor(
    private readonly baseUrl: string,
    private readonly http: HttpClient,
  ) {}

  async quote(loan: LoanRequest): Promise<InsuranceQuote> {
    const payload = { reference: loan.id, days: loan.period.days() };
    let res = await this.http.post(`${this.baseUrl}/quotes`, payload);
    for (let attempt = 1; attempt < 3 && res.status === 503; attempt++) {
      res = await this.http.post(`${this.baseUrl}/quotes`, payload);
    }
    const data = res.json as { premium: number; currency: string };
    return new InsuranceQuote(loan.id, new Money(data.premium, data.currency), 'external-insurer');
  }
}
