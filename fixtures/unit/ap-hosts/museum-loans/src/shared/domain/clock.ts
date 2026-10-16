/** Source of the current instant, injected so that date rules can be tested. */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');
