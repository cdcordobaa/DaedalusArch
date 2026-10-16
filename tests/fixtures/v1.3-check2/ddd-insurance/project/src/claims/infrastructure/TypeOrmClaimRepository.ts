import { DataSource, Repository } from 'typeorm';
import { Claim, ClaimStatus } from '../domain/claim/Claim';
import { ClaimRepository } from '../domain/claim/ClaimRepository';
import { ClaimRecord } from './orm/ClaimRecord';

export class TypeOrmClaimRepository implements ClaimRepository {
  private readonly records: Repository<ClaimRecord>;

  constructor(dataSource: DataSource) {
    this.records = dataSource.getRepository(ClaimRecord);
  }

  async byId(id: string): Promise<Claim | undefined> {
    const r = await this.records.findOne({ where: { id } });
    return r === null ? undefined : new Claim(r.id, r.policyNumber, r.peril, r.incidentOn, r.claimedCents, r.status as ClaimStatus, r.paidCents);
  }

  async save(claim: Claim): Promise<void> {
    await this.records.save(this.records.create({ ...claim }));
  }
}
