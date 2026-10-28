import { Member } from '../../../domain/member';

export interface ChangeMemberEmail {
  execute(memberId: string, email: string): Promise<Member>;
}
