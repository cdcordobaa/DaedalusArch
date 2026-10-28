import { SubmitCasePort } from '../../../application/ports/in/submit-case.port';
import { SubmitCaseRequestDto, SubmitCaseResponseDto } from './case.dto';

export class CaseController {
  constructor(private readonly submitCase: SubmitCasePort) {}

  async post(body: SubmitCaseRequestDto): Promise<SubmitCaseResponseDto> {
    const result = await this.submitCase.submit({
      caseId: body.caseId,
      dentistId: body.dentistId,
      product: body.product,
      teeth: body.teeth,
      scanPayload: body.scanBase64,
    });
    return { caseId: result.caseId, status: result.status, amountCents: result.invoice?.amountCents ?? null };
  }
}
