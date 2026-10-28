import { GetMemberStatement } from '../../../application/ports/in/get-member-statement.port';
import { IssueMonthlyCredits } from '../../../application/ports/in/issue-monthly-credits.port';
import { SubscribeShares } from '../../../application/ports/in/subscribe-shares.port';
import { PAYOUT_PROVIDER_LABEL } from '../../out/payment/labels';
import { DomainError } from '../../../domain/errors';
import { Statement } from '../../../domain/statement';
import {
  ErrorResponseDto,
  IssuedCreditsResponseDto,
  StatementResponseDto,
  SubscribeSharesRequestDto,
  SubscriptionResponseDto,
} from './member.dto';
import { HttpRequest, HttpResponse } from './http-types';

function toStatementDto(statement: Statement): StatementResponseDto {
  return {
    memberName: statement.member.name,
    shares: statement.shares,
    totalCreditsCents: statement.totalCredits().cents,
    creditCount: statement.credits.length,
  };
}

export class MemberController {
  constructor(
    private readonly subscribe: SubscribeShares,
    private readonly issue: IssueMonthlyCredits,
    private readonly statement: GetMemberStatement,
  ) {}

  async subscribeShares(
    req: HttpRequest<SubscribeSharesRequestDto>,
  ): Promise<HttpResponse<SubscriptionResponseDto | ErrorResponseDto>> {
    try {
      const sub = await this.subscribe.execute(req.body);
      return { status: 201, body: { id: sub.id, memberId: sub.memberId, shares: sub.shares } };
    } catch (e) {
      if (e instanceof DomainError) return { status: 400, body: { message: e.message } };
      throw e;
    }
  }

  async getStatement(
    req: HttpRequest,
  ): Promise<HttpResponse<StatementResponseDto | ErrorResponseDto>> {
    try {
      const statement = await this.statement.execute(req.params.memberId);
      return { status: 200, body: toStatementDto(statement) };
    } catch (e) {
      if (e instanceof DomainError) return { status: 404, body: { message: e.message } };
      throw e;
    }
  }

  async issueCredits(req: HttpRequest): Promise<HttpResponse<IssuedCreditsResponseDto>> {
    const issued = await this.issue.execute(req.params.period);
    return { status: 200, body: { issued: issued.length, provider: PAYOUT_PROVIDER_LABEL } };
  }
}
