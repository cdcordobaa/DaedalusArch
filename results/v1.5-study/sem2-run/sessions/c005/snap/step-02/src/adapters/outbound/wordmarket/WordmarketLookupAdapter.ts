import type { JobState, Wordmarket } from 'wordmarket-sdk';
import type { JobSnapshot, JobStage } from '../../../domain/model/JobSnapshot';
import type { JobLookup } from '../../../application/ports/out/marketplace/JobLookup';
import { BureauError } from '../../../domain/errors/BureauError';

const STAGE_BY_STATE: Record<JobState, JobStage> = {
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
    const stage = STAGE_BY_STATE[job.state];
    if (stage === undefined) throw new BureauError('unknown job state ' + String(job.state) + ' for job ' + job.id);
    return { jobId: job.id, translator: job.translatorHandle, stateCode: job.state, stage, updatedAt: job.updatedAt };
  }
}
