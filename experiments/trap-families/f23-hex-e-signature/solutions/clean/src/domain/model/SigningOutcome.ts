/** How a signing ended, as the signature service reports it. */
export type SigningOutcome =
  | { readonly kind: 'declined'; readonly by: string; readonly reason: string }
  | { readonly kind: 'expired' }
  | { readonly kind: 'signed' };
