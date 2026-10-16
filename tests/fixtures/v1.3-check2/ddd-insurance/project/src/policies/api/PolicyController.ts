import { CoverageRequest, IssuePolicy } from '../application/IssuePolicy';

export interface IssuePolicyBody {
  holder: string;
  startsOn: string;
  months: number;
  coverages: CoverageRequest[];
}

export class PolicyController {
  constructor(private readonly issuePolicy: IssuePolicy) {}

  async issue(body: IssuePolicyBody): Promise<{ policyNumber: string }> {
    const policyNumber = await this.issuePolicy.issue(body.holder, new Date(body.startsOn), body.months, body.coverages);
    return { policyNumber };
  }
}
