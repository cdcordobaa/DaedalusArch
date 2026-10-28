import { writeFile } from 'node:fs/promises';
import { StatementArchive } from '../../../application/ports/out/statement-archive.port';
import { Statement } from '../../../domain/statement';

export class FileStatementArchive implements StatementArchive {
  constructor(private readonly directory: string) {}
  async store(memberId: string, statement: Statement): Promise<void> {
    await writeFile(`${this.directory}/${memberId}.json`, JSON.stringify({ memberId, shares: statement.shares }));
  }
}
