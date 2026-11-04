export class HealthController {
  private readonly startedAt = new Date().toISOString();

  get(): { ok: true; startedAt: string } {
    return { ok: true, startedAt: this.startedAt };
  }
}
