import { Money } from "../../../shared-kernel/Money";

export class ClaimLine {
  private constructor(
    readonly id: string,
    readonly description: string,
    readonly amount: Money,
  ) {}

  static create(id: string, description: string, amount: Money): ClaimLine {
    if (!description.trim()) {
      throw new Error("claim line needs a description");
    }
    if (amount.cents <= 0) {
      throw new Error("claim line amount must be positive");
    }
    return new ClaimLine(id, description, amount);
  }
}
