/** Something that happened, written to a journal by the command that caused it. */
export interface Happening {
  readonly kind: string;
}
