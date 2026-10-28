/** How many agreements we can still send for signature in the current billing month, and when that renews. */
export interface SigningAllowance {
  readonly remaining: number;
  readonly renewsOn: Date;
}
