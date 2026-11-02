import { Kysely } from 'kysely';
import fse from 'fs-extra';
import { type Pool } from 'pg';
import pgRequired = require('pg');

export const shapes = (): unknown[] => [Kysely, fse, pgRequired] as unknown[];
export type DomainPool = Pool;
