import { Policy } from './Policy';

export interface PolicyRepository {
  byNumber(number: string): Promise<Policy | undefined>;
  save(policy: Policy): Promise<void>;
}
