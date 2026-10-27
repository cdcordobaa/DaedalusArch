import { DomainEvent } from "../../../shared-kernel/DomainEvent";
import { Money } from "../../../shared-kernel/Money";
import { ClaimLine } from "./ClaimLine";

export interface ClaimLineData {
  readonly description: string;
  readonly amount: Money;
}

export type ClaimStatus = "filed" | "approved" | "rejected" | "paid";

export class ClaimApproved implements DomainEvent {
  readonly name = "ClaimApproved";
  readonly occurredAt = Date.now();
  constructor(
    readonly claimId: string,
    readonly policyId: string,
    readonly amountCents: number,
    readonly currency: string,
  ) {}
}

export class ClaimRejected implements DomainEvent {
  readonly name = "ClaimRejected";
  readonly occurredAt = Date.now();
  constructor(readonly claimId: string, readonly reason: string) {}
}

export class Claim {
  private state: ClaimStatus = "filed";
  private readonly events: DomainEvent[] = [];
  private readonly filedAt = Date.now();

  private constructor(
    readonly id: string,
    readonly policyId: string,
    private readonly lines: readonly ClaimLine[],
  ) {}

  static file(id: string, policyId: string, lines: readonly ClaimLineData[]): Claim {
    if (!id.trim() || !policyId.trim()) {
      throw new Error("claim needs an id and a policy id");
    }
    if (lines.length === 0) {
      throw new Error("claim needs at least one line");
    }
    const items = lines.map((line, i) => ClaimLine.create(`${id}-${i + 1}`, line.description, line.amount));
    return new Claim(id, policyId, items);
  }

  static fileNumbered(nextNumber: () => number, policyId: string, lines: readonly ClaimLineData[]): Claim {
    return Claim.file(`CLM-${nextNumber()}`, policyId, lines);
  }

  total(): Money {
    return this.lines.reduce((sum, line) => sum.plus(line.amount), Money.zero(this.lines[0].amount.currency));
  }

  currentStatus(): ClaimStatus {
    return this.state;
  }

  lineItems(): readonly ClaimLine[] {
    return this.lines;
  }

  approve(): void {
    if (this.state !== "filed") {
      throw new Error("only filed claims can be approved");
    }
    this.state = "approved";
    const total = this.total();
    this.events.push(new ClaimApproved(this.id, this.policyId, total.cents, total.currency));
  }

  reject(reason: string): void {
    if (this.state !== "filed") {
      throw new Error("only filed claims can be rejected");
    }
    this.state = "rejected";
    this.events.push(new ClaimRejected(this.id, reason));
  }

  markPaid(): void {
    if (this.state !== "approved") {
      throw new Error("only approved claims can be paid");
    }
    this.state = "paid";
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }
}
