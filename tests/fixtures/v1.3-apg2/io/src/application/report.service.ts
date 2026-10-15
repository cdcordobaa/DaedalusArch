import { readFileSync } from 'fs';
import { Repository } from 'typeorm';

export class ReportRow {
  id = 0;
}

// IO6: a TypeORM repository used by an application service (db, blocking). v1.3 domain-purity covers the domain only.
// IO7: file-system read in an application service (fs, blocking).
export class ReportService {
  constructor(private readonly rows: Repository<ReportRow>) {}

  async load(): Promise<ReportRow[]> {
    return this.rows.find();
  }

  template(): string {
    return readFileSync('./report.tpl', 'utf8');
  }
}
