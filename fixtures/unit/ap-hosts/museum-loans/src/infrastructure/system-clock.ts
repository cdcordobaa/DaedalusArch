import { Clock } from '../shared/domain/clock';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
