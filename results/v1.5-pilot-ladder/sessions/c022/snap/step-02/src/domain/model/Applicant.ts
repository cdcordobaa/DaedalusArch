/** Someone waiting for a garden plot, in the order they joined the list. */
export interface Applicant {
  readonly name: string;
  readonly email: string;
  /** Members of the garden association go first. */
  readonly member: boolean;
}
