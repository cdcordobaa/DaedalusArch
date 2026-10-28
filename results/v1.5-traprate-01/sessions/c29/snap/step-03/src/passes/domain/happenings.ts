export type PassHappening =
  | { readonly kind: 'PassIssued'; readonly passNo: string; readonly holder: string }
  | { readonly kind: 'CreditChanged'; readonly passNo: string; readonly by: number; readonly note: string }
  | { readonly kind: 'PassBlocked'; readonly passNo: string }
  | { readonly kind: 'FeePaid'; readonly passNo: string; readonly lessonId: string }
  | { readonly kind: 'FeeDeclined'; readonly passNo: string; readonly lessonId: string };
