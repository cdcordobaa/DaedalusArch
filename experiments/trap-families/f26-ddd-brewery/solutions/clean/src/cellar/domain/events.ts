/** Facts the cellar records when a change is kept. Each store hands them to the mailbox in the same step. */
export type CellarEvent =
  | {
      readonly kind: 'lot-received';
      readonly lotId: string;
      readonly ingredient: string;
      readonly grams: number;
    }
  | {
      /** A batch was brewed; each listed lot still has to give up its grams. */
      readonly kind: 'batch-brewed';
      readonly batchId: string;
      readonly draws: readonly { readonly lotId: string; readonly grams: number }[];
    };
