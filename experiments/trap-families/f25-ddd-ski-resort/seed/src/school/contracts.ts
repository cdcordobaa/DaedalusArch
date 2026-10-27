/** What the rest of the resort may know about a lesson. */
export interface LessonView {
  readonly lessonId: string;
  readonly title: string;
  readonly day: string;
  readonly price: number;
  readonly places: number;
  readonly placesLeft: number;
  readonly status: string;
}
