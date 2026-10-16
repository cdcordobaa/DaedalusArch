import type { GetMemberUseCase } from '../../../application/membership/GetMemberUseCase';
import type { RegisterMemberUseCase } from '../../../application/membership/RegisterMemberUseCase';
import type { Member } from '../../../domain/membership/Member';
import { errorResponse, field } from './http';
import type { HttpRequest, HttpResponse } from './http';

const toJson = (m: Member) => ({ id: m.id, name: m.name, email: m.email.value, borrowingLimit: m.borrowingLimit });

/** POST /members, GET /members/:id */
export class MemberController {
  constructor(
    private readonly registerMember: RegisterMemberUseCase,
    private readonly getMember: GetMemberUseCase,
  ) {}

  async register(req: HttpRequest): Promise<HttpResponse> {
    try {
      const member = await this.registerMember.execute({
        name: String(field(req.body, 'name') ?? ''),
        email: String(field(req.body, 'email') ?? ''),
      });
      return { status: 201, body: toJson(member) };
    } catch (err) {
      return errorResponse(err);
    }
  }

  async get(req: HttpRequest): Promise<HttpResponse> {
    try {
      return { status: 200, body: toJson(await this.getMember.execute(req.params?.id ?? '')) };
    } catch (err) {
      return errorResponse(err);
    }
  }
}
