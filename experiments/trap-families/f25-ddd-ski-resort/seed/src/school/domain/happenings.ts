export type SchoolHappening =
  | { readonly kind: 'LessonOffered'; readonly lessonId: string; readonly day: string };
