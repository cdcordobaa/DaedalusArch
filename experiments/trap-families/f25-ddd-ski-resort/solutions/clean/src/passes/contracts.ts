/** What the rest of the resort may know about passes. */
export interface PassView {
  readonly passNo: string;
  readonly holder: string;
  readonly credit: number;
  readonly status: string;
}

/** Happenings of the pass office that others may react to. */
export interface PassIssuedNotice {
  readonly kind: 'PassIssued';
  readonly passNo: string;
  readonly holder: string;
}

export interface LessonPaidNotice {
  readonly kind: 'LessonPaid';
  readonly passNo: string;
  readonly lessonId: string;
}

export interface LessonPaymentRefusedNotice {
  readonly kind: 'LessonPaymentRefused';
  readonly passNo: string;
  readonly lessonId: string;
  readonly why: string;
}

export interface PassBlockedNotice {
  readonly kind: 'PassBlocked';
  readonly passNo: string;
}
