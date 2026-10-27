export type SchoolHappening =
  | { readonly kind: 'LessonOffered'; readonly lessonId: string; readonly day: string }
  | { readonly kind: 'PlaceReserved'; readonly lessonId: string; readonly passNo: string; readonly price: number }
  | { readonly kind: 'LessonCalledOff'; readonly lessonId: string; readonly refunds: readonly { readonly passNo: string; readonly euros: number }[] }
  | { readonly kind: 'PlaceGivenBack'; readonly lessonId: string; readonly passNo: string; readonly euros: number };
