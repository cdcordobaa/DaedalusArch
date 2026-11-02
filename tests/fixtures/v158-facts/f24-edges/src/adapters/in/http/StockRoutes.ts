import { MemoryLockers } from '../shared';
import { minutesOf } from '../shared/time';

export const stockRoutes = (lockers: MemoryLockers): unknown[] => [lockers, minutesOf('08:00')];
