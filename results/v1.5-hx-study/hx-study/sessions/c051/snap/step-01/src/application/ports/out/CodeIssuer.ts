/** Hands out six-digit pickup codes. */
export interface CodeIssuer {
  next(): string;
}
