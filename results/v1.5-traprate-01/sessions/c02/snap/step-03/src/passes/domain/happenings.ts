export type PassHappening =
  | { readonly kind: 'PassIssued'; readonly passNo: string; readonly holder: string }
  | { readonly kind: 'PassBlocked'; readonly passNo: string }
  | { readonly kind: 'CreditChanged'; readonly passNo: string; readonly by: number; readonly note: string };
