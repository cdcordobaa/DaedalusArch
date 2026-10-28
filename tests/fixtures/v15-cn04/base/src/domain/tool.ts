import { ToolError } from './errors';

export type ToolCondition = 'good' | 'worn' | 'broken';

/** A tool members can borrow; it decides itself whether it can be lent. */
export class Tool {
  constructor(
    readonly id: string,
    readonly name: string,
    private condition_: ToolCondition,
    private lentTo_: string | null = null,
    readonly depositCents: number = 2000,
    readonly version: number = 0,
  ) {}

  get condition(): ToolCondition { return this.condition_; }
  get lentTo(): string | null { return this.lentTo_; }
  get available(): boolean { return this.lentTo_ === null && this.condition_ !== 'broken'; }

  lend(member: string): void {
    if (!this.available) throw new ToolError('the tool is not available');
    this.lentTo_ = member;
  }

  markBroken(): void { this.condition_ = 'broken'; }
}
