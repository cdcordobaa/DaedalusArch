export type PassHappening =
  | { readonly kind: 'PassIssued'; readonly passNo: string; readonly holder: string }
  | { readonly kind: 'CreditChanged'; readonly passNo: string; readonly by: number; readonly note: string }
  | { readonly kind: 'LessonPaid'; readonly passNo: string; readonly lessonId: string }
  | { readonly kind: 'LessonPaymentRefused'; readonly passNo: string; readonly lessonId: string; readonly why: string }
  | { readonly kind: 'PassBlocked'; readonly passNo: string };
