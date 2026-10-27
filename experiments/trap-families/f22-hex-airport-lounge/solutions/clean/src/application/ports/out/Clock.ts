import type { Instant } from '../../../domain/model/Instant';

export interface Clock {
  now(): Instant;
}
