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

/** Happenings of the school that others may react to. */
export interface FeeRequestedNotice {
  readonly kind: 'FeeRequested';
  readonly passNo: string;
  readonly lessonId: string;
  readonly euros: number;
}

export interface FeeRefundDueNotice {
  readonly kind: 'FeeRefundDue';
  readonly passNo: string;
  readonly lessonId: string;
  readonly euros: number;
}
