import { DateRange } from '../../shared/domain/date-range';
import { DomainError } from '../../shared/domain/domain-error';
import { ExhibitionStatus } from './exhibition-status';
import { GalleryCapacity } from './gallery';

export class ExhibitionNotEditableError extends DomainError {
  constructor(id: string, status: ExhibitionStatus) {
    super('EXHIBITION_NOT_EDITABLE', `Exhibition ${id} is ${status} and can no longer be changed`);
  }
}

export class GalleryDoubleBookedError extends DomainError {
  constructor(galleryCode: string, otherTitle: string) {
    super('GALLERY_DOUBLE_BOOKED', `Gallery ${galleryCode} is already booked for "${otherTitle}" in that period`);
  }
}

/** A planned or running exhibition in one gallery. */
export class Exhibition {
  status: ExhibitionStatus;
  run: DateRange;

  constructor(
    readonly id: string,
    readonly title: string,
    readonly galleryCode: string,
    run: DateRange,
    readonly capacity: GalleryCapacity,
    status: ExhibitionStatus,
  ) {
    this.run = run;
    this.status = status;
  }

  isEditable(): boolean {
    return this.status === 'planned';
  }

  reschedule(run: DateRange): void {
    if (!this.isEditable()) {
      throw new ExhibitionNotEditableError(this.id, this.status);
    }
    this.run = run;
  }

  ensureNoClashWith(other: Exhibition): void {
    if (other.id !== this.id && other.galleryCode === this.galleryCode && other.status !== 'cancelled' && other.run.overlaps(this.run)) {
      throw new GalleryDoubleBookedError(this.galleryCode, other.title);
    }
  }
}
