import type { LendCostumes } from '../../../application/ports/in/LendCostumes';

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/** POST /hires and POST /hires/:id/return, for the wardrobe desk. */
export class WardrobeController {
  constructor(private readonly costumes: LendCostumes) {}

  postHire(body: Record<string, unknown>): Promise<HttpResponse> {
    return this.run(() => this.costumes.lend(String(body.hireId ?? ''), String(body.costumeId ?? ''), String(body.from ?? ''), Number(body.days)));
  }

  postReturn(hireId: string, body: Record<string, unknown>): Promise<HttpResponse> {
    return this.run(() => this.costumes.takeBack(hireId, String(body.returnedOn ?? '')));
  }

  getHandCleaning(): Promise<HttpResponse> {
    return this.run(() => this.costumes.handCleaning());
  }

  protected async run(fn: () => Promise<unknown>): Promise<HttpResponse> {
    try {
      return { status: 200, body: await fn() };
    } catch (e) {
      return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }
}
