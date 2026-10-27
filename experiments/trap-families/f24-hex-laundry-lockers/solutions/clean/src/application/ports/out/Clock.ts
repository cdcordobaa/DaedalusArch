export interface Clock {
  /** Now, written YYYY-MM-DDTHH:MM. */
  now(): string;
}
