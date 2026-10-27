/** What other parts of the system may know about a sign-up. */
export interface SignUpView {
  readonly id: string;
  readonly volunteer: string;
  readonly shiftId: string;
  readonly places: number;
  readonly status: string;
}
