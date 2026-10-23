import { BaseRepository } from './base.repository';
import { JobEntity, JobModel } from './job.entity';

export class JobRepository extends BaseRepository<JobModel, JobEntity> {}
