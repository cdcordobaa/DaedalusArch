import type { MemberRepository } from '../domain/member/MemberRepository';

export class AwardPoints {
  constructor(private readonly members: MemberRepository) {}

  execute(memberId: string, points: number): void {
    const m = this.members.byId(memberId);
    if (m === undefined) throw new Error(`no member ${memberId}`);
    m.award(points);
    this.members.save(m);
  }
}
