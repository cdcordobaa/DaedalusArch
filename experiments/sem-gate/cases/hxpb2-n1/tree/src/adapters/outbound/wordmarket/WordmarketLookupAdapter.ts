import type { JobState, Wordmarket } from 'wordmarket-sdk';
import type { JobProgress } from '../../../domain/model/JobProgress';
import type { JobSnapshot } from '../../../domain/model/JobSnapshot';
import type { JobLookup } from '../../../application/ports/out/marketplace/JobLookup';

const PROGRESS: Record<JobState, JobProgress> = {
  posted: 'unassigned',
  claimed: 'translating',
  drafting: 'translating',
  proofreading: 'checking',
  delivered: 'done',
  disputed: 'onHold',
};

export class WordmarketLookupAdapter implements JobLookup {
  constructor(private readonly market: Wordmarket) {}

  async snapshot(jobId: string): Promise<JobSnapshot> {
    const job = await this.market.jobs.get(jobId);
    return { jobId: job.id, translator: job.translatorHandle, stateCode: job.state, updatedAt: job.updatedAt, progress: PROGRESS[job.state] };
  }
}
