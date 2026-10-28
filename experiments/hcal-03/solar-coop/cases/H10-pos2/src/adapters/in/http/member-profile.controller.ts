import { ChangeMemberEmail } from '../../../application/ports/in/change-member-email.port';
import { Member } from '../../../domain/member';
import { HttpRequest, HttpResponse } from './http-types';

export class MemberProfileController {
  constructor(private readonly changeEmail: ChangeMemberEmail) {}

  async updateProfile(req: HttpRequest<Member>): Promise<HttpResponse<{ id: string; email: string }>> {
    const member = await this.changeEmail.execute(req.params.memberId, req.body.email);
    return { status: 200, body: { id: member.id, email: member.email } };
  }
}
