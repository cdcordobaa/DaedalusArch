/** A household's direct debit as our plan letters show it. */
export interface MandateRecord {
  readonly mandateId: string;
  readonly reference: string;
  /** The direct debit provider's own status text, printed on the plan letter as is. */
  readonly providerStatus: string;
  /** True when the provider reports the mandate as active, so a plan may start on it. */
  readonly active: boolean;
}
