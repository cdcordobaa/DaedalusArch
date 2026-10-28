/** Facts the cellar records when a change is kept. Each store hands them to the mailbox in the same step. */
export type CellarEvent = {
  readonly kind: 'lot-received';
  readonly lotId: string;
  readonly ingredient: string;
  readonly grams: number;
};
