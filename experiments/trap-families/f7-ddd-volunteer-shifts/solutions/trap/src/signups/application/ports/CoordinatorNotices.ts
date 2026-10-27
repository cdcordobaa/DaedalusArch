/** Notices shown to the shift coordinators. */
export interface CoordinatorNotices {
  add(text: string): void;
  all(): string[];
}
