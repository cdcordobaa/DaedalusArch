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

export interface FeePaidNotice {
  readonly kind: 'FeePaid';
  readonly passNo: string;
  readonly lessonId: string;
}

export interface FeeDeclinedNotice {
  readonly kind: 'FeeDeclined';
  readonly passNo: string;
  readonly lessonId: string;
}
