import { Repository } from 'typeorm';

/** NEAR-MISS N4: ORM frameworks are outside the vendor catalogue (FF-P01 and repo-bypass cover them). */
export class ReportArchive {
  constructor(private readonly repo: Repository<{ id: string }>) {}

  keep(id: string): Promise<{ id: string }> {
    return this.repo.save({ id });
  }
}
