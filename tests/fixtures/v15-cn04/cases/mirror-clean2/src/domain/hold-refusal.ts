/** Two vendor codes plus a value of the library's own (not a catch-all): not the vendor's set. */
export type HoldRefusal = 'limit_exceeded' | 'card_blocked' | 'card-expired';

/** One vendor code plus a catch-all: fewer than 2 vendor values. */
export type HoldCheck = 'card_blocked' | 'unknown';
