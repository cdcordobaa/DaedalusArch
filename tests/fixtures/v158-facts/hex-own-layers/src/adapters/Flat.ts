import { PgClient } from './pg/PgClient';
import { other } from './Other';

export const flat = (): string[] => new PgClient().query(other());
