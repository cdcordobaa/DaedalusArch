import type { JobState, Wordmarket } from 'wordmarket-sdk';
import type { JobSnapshot } from '../../../domain/model/JobSnapshot';
import type { ProgressStage } from '../../../domain/model/ProgressStage';
import { BureauError } from '../../../domain/errors/BureauError';
import type { JobLookup } from '../../../application/ports/out/marketplace/JobLookup';

const STAGES: Record<JobState, ProgressStage> = {
  posted: 'FINDING_TRANSLATOR',
  claimed: 'IN_TRANSLATION',
  drafting: 'IN_TRANSLATION',
  proofreading: 'BEING_CHECKED',
  delivered: 'READY_TO_DOWNLOAD',
  disputed: 'ON_HOLD',
};

export class WordmarketLookupAdapter implements JobLookup {
  constructor(private readonly market: Wordmarket) {}

  async snapshot(jobId: string): Promise<JobSnapshot> {
    const job = await this.market.jobs.get(jobId);
    const stage = STAGES[job.state];
    if (stage === undefined) throw new BureauError('unknown marketplace job state ' + String(job.state));
    return { jobId: job.id, translator: job.translatorHandle, stateCode: job.state, stage, updatedAt: job.updatedAt };
  }
}
