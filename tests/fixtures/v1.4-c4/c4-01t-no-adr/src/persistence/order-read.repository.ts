export class OrderReadRepository {
  private readonly summaries = new Map<string, string[]>();

  findSummaries(customerId: string): readonly string[] {
    return this.summaries.get(customerId) ?? [];
  }
}
