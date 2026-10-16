import { Member } from '@prisma/client';

export interface RegisterMemberInput {
  readonly fullName: string;
  readonly email: string;
  readonly company: string | null;
}

export interface MemberView {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly company: string | null;
}

export function toMemberView(m: Member): MemberView {
  return { id: m.id, fullName: m.fullName, email: m.email, company: m.company };
}
