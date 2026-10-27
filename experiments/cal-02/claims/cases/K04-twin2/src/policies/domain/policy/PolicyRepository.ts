import { Policy } from "./Policy";

export interface PolicyRepository {
  save(policy: Policy): void;
  byId(id: string): Policy | undefined;
  byHolder(holder: string): Policy[];
}
