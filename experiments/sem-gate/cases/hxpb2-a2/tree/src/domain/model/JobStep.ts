/** Where a marketplace job is. */
export const JobStep = {
  Open: 'open',
  Taken: 'taken',
  Writing: 'writing',
  Review: 'review',
  Handed: 'handed',
  Contested: 'contested',
} as const;
export type JobStep = (typeof JobStep)[keyof typeof JobStep];

/** The step for the state text a job snapshot carries. */
export function stepOf(stateCode: string): JobStep {
  switch (stateCode) {
    case 'posted': return JobStep.Open;
    case 'claimed': return JobStep.Taken;
    case 'drafting': return JobStep.Writing;
    case 'proofreading': return JobStep.Review;
    case 'delivered': return JobStep.Handed;
    default: return JobStep.Contested;
  }
}
