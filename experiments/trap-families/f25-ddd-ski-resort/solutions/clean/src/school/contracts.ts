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
export interface PlaceReservedNotice {
  readonly kind: 'PlaceReserved';
  readonly lessonId: string;
  readonly passNo: string;
  readonly price: number;
}

export interface LessonCalledOffNotice {
  readonly kind: 'LessonCalledOff';
  readonly lessonId: string;
  readonly refunds: readonly { readonly passNo: string; readonly euros: number }[];
}

export interface PlaceGivenBackNotice {
  readonly kind: 'PlaceGivenBack';
  readonly lessonId: string;
  readonly passNo: string;
  readonly euros: number;
}
