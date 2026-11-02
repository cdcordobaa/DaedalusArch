import type { JobState, Wordmarket } from 'wordmarket-sdk';
import type { JobProgress } from '../../../domain/model/JobProgress';
import type { JobSnapshot } from '../../../domain/model/JobSnapshot';
import type { JobLookup } from '../../../application/ports/out/marketplace/JobLookup';

function progressOf(state: JobState): JobProgress {
  switch (state) {
    case 'posted': return 'open';
    case 'claimed': return 'taken';
    case 'drafting': return 'writing';
    case 'proofreading': return 'review';
    case 'delivered': return 'handed';
    case 'disputed': return 'contested';
  }
}

export class WordmarketLookupAdapter implements JobLookup {
  constructor(private readonly market: Wordmarket) {}

  async snapshot(jobId: string): Promise<JobSnapshot> {
    const job = await this.market.jobs.get(jobId);
    return { jobId: job.id, translator: job.translatorHandle, stateCode: job.state, updatedAt: job.updatedAt, progress: progressOf(job.state) };
  }
}
