import { randomUUID } from 'node:crypto';
import { Clock, IdFactory } from '../../application/ports/outbound';

export const systemClock: Clock = { nowIso: () => new Date().toISOString() };
export const uuidFactory: IdFactory = { newId: () => randomUUID() };
