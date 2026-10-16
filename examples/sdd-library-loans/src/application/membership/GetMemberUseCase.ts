import { NotFoundError } from '../../domain/catalog/errors';
import type { Member } from '../../domain/membership/Member';
import type { MemberRepository } from '../ports/MemberRepository';

export class GetMemberUseCase {
  constructor(private readonly members: MemberRepository) {}

  async execute(id: string): Promise<Member> {
    const member = await this.members.findById(id);
    if (member === undefined) throw new NotFoundError(`member ${id}`);
    return member;
  }
}
