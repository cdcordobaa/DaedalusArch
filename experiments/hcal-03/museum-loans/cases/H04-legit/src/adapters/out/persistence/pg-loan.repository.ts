import type { PoolClient } from 'pg';
import { LoanRepository } from '../../../application/ports/out/loan-repository.port';
import { LoanRequest } from '../../../domain/loan-request';
import { DateRange } from '../../../domain/value-objects';

interface LoanRow {
  id: string;
  artwork_id: string;
  borrower: string;
  start_date: string;
  end_date: string;
}

export class PgLoanRepository implements LoanRepository {
  constructor(private readonly client: PoolClient) {}

  async save(loan: LoanRequest): Promise<void> {
    await this.client.query(
      'INSERT INTO loans (id, artwork_id, borrower, start_date, end_date) VALUES ($1, $2, $3, $4, $5)',
      [loan.id, loan.artworkId, loan.borrower, loan.period.start, loan.period.end],
    );
  }

  async findById(id: string): Promise<LoanRequest | null> {
    const result = await this.client.query('SELECT * FROM loans WHERE id = $1', [id]);
    const row = result.rows[0] as LoanRow | undefined;
    if (!row) return null;
    const period = new DateRange(new Date(row.start_date), new Date(row.end_date));
    return new LoanRequest(row.id, row.artwork_id, row.borrower, period);
  }
}
