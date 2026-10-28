import type { Pool } from '../../domain/pooling/Pool';

/** The pools that are driving now. */
export interface OpenPools {
  /** Pools with a free seat, in the order they were opened. */
  withFreeSeats(): Pool[];
  nextId(): string;
  save(pool: Pool): void;
}
