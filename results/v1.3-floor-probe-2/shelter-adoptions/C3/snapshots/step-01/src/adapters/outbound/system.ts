import { randomUUID } from 'node:crypto';
import { Clock, Ids } from '../../application/ports';

export const clock: Clock = { now: () => new Date().toISOString() };
export const ids: Ids = { next: () => randomUUID() };
