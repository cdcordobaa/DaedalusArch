/** Gallery codes follow the building plan: wing letter, floor digit, room number (`E2-14`). */
const GALLERY_CODE = /^[A-Z][0-9]-[0-9]{2}$/;

export function isGalleryCode(value: string): boolean {
  return GALLERY_CODE.test(value);
}

/** Visitor capacity of a gallery for one exhibition, bounded by the fire-safety certificate. */
export class GalleryCapacity {
  static readonly FIRE_CODE_LIMIT = 400;

  readonly visitors: number;

  constructor(visitors: number) {
    this.visitors = Math.min(visitors, GalleryCapacity.FIRE_CODE_LIMIT);
  }

  timedEntrySlots(slotMinutes: number, openMinutes: number): number {
    return Math.floor(openMinutes / slotMinutes) * this.visitors;
  }
}
