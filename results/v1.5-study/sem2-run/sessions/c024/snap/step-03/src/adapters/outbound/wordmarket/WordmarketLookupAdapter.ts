import type { JobState, Wordmarket } from 'wordmarket-sdk';
import type { JobSnapshot, OrderStage } from '../../../domain/model/JobSnapshot';
import type { JobLookup } from '../../../application/ports/out/marketplace/JobLookup';

function stageOf(state: JobState): OrderStage {
  switch (state) {
    case 'posted': return 'FINDING_TRANSLATOR';
    case 'claimed':
    case 'drafting': return 'IN_TRANSLATION';
    case 'proofreading': return 'BEING_CHECKED';
    case 'delivered': return 'READY_TO_DOWNLOAD';
    case 'disputed': return 'ON_HOLD';
  }
}

export class WordmarketLookupAdapter implements JobLookup {
  constructor(private readonly market: Wordmarket) {}

  async snapshot(jobId: string): Promise<JobSnapshot> {
    const job = await this.market.jobs.get(jobId);
    return { jobId: job.id, translator: job.translatorHandle, stateCode: job.state, stage: stageOf(job.state), updatedAt: job.updatedAt };
  }
}
