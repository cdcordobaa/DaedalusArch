/** Notices shown to the booking desk. */
export interface DeskNotices {
  add(text: string): void;
  all(): string[];
}
