/** Notices shown to the car park attendants. */
export interface AttendantNotices {
  add(text: string): void;
  all(): string[];
}
