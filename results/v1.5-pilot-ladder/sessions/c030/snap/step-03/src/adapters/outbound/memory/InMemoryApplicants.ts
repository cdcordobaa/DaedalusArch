import type { Applicant } from '../../../domain/model/Applicant';
import type { Applicants } from '../../../application/ports/out/Applicants';

export class InMemoryApplicants implements Applicants {
  private rows: Applicant[] = [];

  async add(applicant: Applicant): Promise<void> {
    this.rows.push(applicant);
  }

  async all(): Promise<Applicant[]> {
    return [...this.rows];
  }

  async remove(email: string): Promise<void> {
    this.rows = this.rows.filter((a) => a.email !== email);
  }

  async moveToEnd(email: string): Promise<void> {
    const a = this.rows.find((x) => x.email === email);
    if (a === undefined) return;
    this.rows = [...this.rows.filter((x) => x.email !== email), a];
  }
}
