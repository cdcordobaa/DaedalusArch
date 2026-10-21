import { Member } from '../domain/member/Member';
import type { MemberRepository } from '../domain/member/MemberRepository';

export class EnrolMember {
  constructor(private readonly members: MemberRepository) {}

  execute(name: string): string {
    const member = Member.enrol(this.members.nextId(), name);
    this.members.save(member);
    return member.id.value;
  }
}
