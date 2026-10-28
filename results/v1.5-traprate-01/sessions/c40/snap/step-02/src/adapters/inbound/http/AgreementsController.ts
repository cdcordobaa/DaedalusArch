import type { DraftRequest, ManageAgreements } from '../../../application/ports/in/ManageAgreements';
import type { ShowAllowance } from '../../../application/ports/in/ShowAllowance';

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/** POST /agreements, GET /agreements/:id and GET /signing-allowance. */
export class AgreementsController {
  constructor(
    private readonly agreements: ManageAgreements,
    private readonly allowance: ShowAllowance,
  ) {}

  async postAgreement(body: DraftRequest): Promise<HttpResponse> {
    try {
      return { status: 201, body: { id: await this.agreements.draft(body) } };
    } catch (e) {
      return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }

  async getAgreement(id: string): Promise<HttpResponse> {
    try {
      return { status: 200, body: await this.agreements.view(id) };
    } catch (e) {
      return { status: 404, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }

  async postSend(id: string): Promise<HttpResponse> {
    try {
      await this.agreements.send(id);
      return { status: 200, body: await this.agreements.view(id) };
    } catch (e) {
      return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }

  async getAllowance(): Promise<HttpResponse> {
    return { status: 200, body: await this.allowance.allowance() };
  }
}
