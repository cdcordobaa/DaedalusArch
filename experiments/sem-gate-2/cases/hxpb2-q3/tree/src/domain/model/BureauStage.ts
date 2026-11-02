/** The stages of the bureau's order book (ARCHITECTURE.md, bureau glossary). */
export enum BureauStage {
  Offered = 'offered',
  Assigned = 'assigned',
  Drafting = 'drafting',
  Proofing = 'proofing',
  Delivered = 'delivered',
  Queried = 'queried',
}

/** The stage for the state text a job snapshot carries. */
export const BUREAU_STAGE_OF: Readonly<Record<string, BureauStage | undefined>> = {
  posted: BureauStage.Offered,
  claimed: BureauStage.Assigned,
  drafting: BureauStage.Drafting,
  proofreading: BureauStage.Proofing,
  delivered: BureauStage.Delivered,
  disputed: BureauStage.Queried,
};
