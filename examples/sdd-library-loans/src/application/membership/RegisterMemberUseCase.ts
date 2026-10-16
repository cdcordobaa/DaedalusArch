import { Email } from '../../domain/membership/Email';
import { DuplicateMemberError, Member } from '../../domain/membership/Member';
import type { MemberRepository } from '../ports/MemberRepository';

export class RegisterMemberUseCase {
  constructor(private readonly members: MemberRepository) {}

  async execute(cmd: { readonly name: string; readonly email: string }): Promise<Member> {
    const email = Email.of(cmd.email);
    if ((await this.members.findByEmail(email)) !== undefined) throw new DuplicateMemberError(email.value);
    const member = Member.register(await this.members.nextId(), cmd.name, email);
    await this.members.save(member);
    return member;
  }
}
