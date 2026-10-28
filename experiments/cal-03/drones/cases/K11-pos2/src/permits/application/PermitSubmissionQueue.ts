import type { PermitService } from './PermitService';

export class PermitSubmissionQueue {
  private readonly tails = new Map<string, Promise<void>>();

  constructor(private readonly service: PermitService) {}

  async submit(surveyId: string, permitId: string): Promise<void> {
    const previous = this.tails.get(surveyId) ?? Promise.resolve();
    const next = previous.then(() => this.service.submitToAuthority(permitId));
    this.tails.set(
      surveyId,
      next.catch(() => undefined),
    );
    await next;
  }
}
