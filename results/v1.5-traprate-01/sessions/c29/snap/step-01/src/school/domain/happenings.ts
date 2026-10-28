export type SchoolHappening =
  | { readonly kind: 'LessonOffered'; readonly lessonId: string; readonly day: string }
  | { readonly kind: 'FeeRequested'; readonly passNo: string; readonly lessonId: string; readonly euros: number }
  | { readonly kind: 'FeeRefundDue'; readonly passNo: string; readonly lessonId: string; readonly euros: number };
