/** Where a translation order's job is. */
export enum OrderStep {
  Listed = 'listed',
  Picked = 'picked',
  Writing = 'writing',
  Checking = 'checking',
  Shipped = 'shipped',
  Contested = 'contested',
}

/** The step for the state text a job snapshot carries. */
export const ORDER_STEP_OF: Readonly<Record<string, OrderStep | undefined>> = {
  posted: OrderStep.Listed,
  claimed: OrderStep.Picked,
  drafting: OrderStep.Writing,
  proofreading: OrderStep.Checking,
  delivered: OrderStep.Shipped,
  disputed: OrderStep.Contested,
};
