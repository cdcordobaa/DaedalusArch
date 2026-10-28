import { ChangeMemberEmail } from '../../../application/ports/in/change-member-email.port';
import { HttpRequest, HttpResponse } from './http-types';
import { ChangeEmailRequestDto, MemberResponseDto } from './member-profile.dto';

export class MemberProfileController {
  constructor(private readonly changeEmail: ChangeMemberEmail) {}

  async updateProfile(req: HttpRequest<ChangeEmailRequestDto>): Promise<HttpResponse<MemberResponseDto>> {
    const member = await this.changeEmail.execute(req.params.memberId, req.body.email);
    return { status: 200, body: { id: member.id, email: member.email } };
  }
}
