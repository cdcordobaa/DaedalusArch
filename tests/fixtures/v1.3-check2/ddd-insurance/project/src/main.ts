import { DataSource } from 'typeorm';
import { ClaimController } from './claims/api/ClaimController';
import { PolicyCoverageAcl } from './claims/acl/PolicyCoverageAcl';
import { FileClaim } from './claims/application/FileClaim';
import { SettleClaim } from './claims/application/SettleClaim';
import { InMemoryClaimRepository } from './claims/infrastructure/InMemoryClaimRepository';
import { TypeOrmClaimRepository } from './claims/infrastructure/TypeOrmClaimRepository';
import { PolicyController } from './policies/api/PolicyController';
import { IssuePolicy } from './policies/application/IssuePolicy';
import { LookUpCoverage } from './policies/application/LookUpCoverage';
import { InMemoryPolicyRepository } from './policies/infrastructure/InMemoryPolicyRepository';

export function compose(dataSource?: DataSource): { policies: PolicyController; claims: ClaimController } {
  const policyRepository = new InMemoryPolicyRepository();
  const claimRepository = dataSource === undefined ? new InMemoryClaimRepository() : new TypeOrmClaimRepository(dataSource);
  const coverage = new PolicyCoverageAcl(new LookUpCoverage(policyRepository));
  return {
    policies: new PolicyController(new IssuePolicy(policyRepository)),
    claims: new ClaimController(new FileClaim(claimRepository, coverage), new SettleClaim(claimRepository, coverage)),
  };
}
