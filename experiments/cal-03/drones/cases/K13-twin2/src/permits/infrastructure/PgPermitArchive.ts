import type { PoolClient } from 'pg';
import type { PermitArchive } from '../application/ports/PermitArchive';

export class PgPermitArchive implements PermitArchive {
  constructor(private readonly client: PoolClient) {}

  archive(permitId: string): void {
    this.client.query('insert into permit_archive (id) values ($1)', [permitId]);
  }
}
