import type { JobState, Wordmarket } from 'wordmarket-sdk';
import type { JobSnapshot, OrderStage } from '../../../domain/model/JobSnapshot';
import type { JobLookup } from '../../../application/ports/out/marketplace/JobLookup';

const STAGE_BY_STATE: Record<JobState, OrderStage> = {
  posted: 'FINDING_TRANSLATOR',
  claimed: 'IN_TRANSLATION',
  drafting: 'IN_TRANSLATION',
  proofreading: 'IN_TRANSLATION',
  delivered: 'READY_TO_DOWNLOAD',
  disputed: 'ON_HOLD',
};

export class WordmarketLookupAdapter implements JobLookup {
  constructor(private readonly market: Wordmarket) {}

  async snapshot(jobId: string): Promise<JobSnapshot> {
    const job = await this.market.jobs.get(jobId);
    return { jobId: job.id, translator: job.translatorHandle, stateCode: job.state, stage: STAGE_BY_STATE[job.state], updatedAt: job.updatedAt };
  }
}
