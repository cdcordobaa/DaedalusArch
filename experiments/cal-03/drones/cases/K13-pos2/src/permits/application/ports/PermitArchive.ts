import type { PoolClient } from 'pg';

export interface PermitArchive {
  archive(permitId: string, client: PoolClient): void;
}
