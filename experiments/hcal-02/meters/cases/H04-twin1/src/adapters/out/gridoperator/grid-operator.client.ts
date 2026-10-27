import type { GridOperatorPort } from "../../../application/ports/out/grid-operator.port";

export interface GridClientOptions {
  readonly timeoutMs: number;
}

export class GridOperatorClient implements GridOperatorPort {
  constructor(private readonly options: GridClientOptions = { timeoutMs: 1000 }) {}

  async fetchReference(meterId: string): Promise<number | null> {
    // stand-in for the remote call to the grid operator
    const known: Record<string, number> = {};
    return known[meterId] ?? null;
  }

  async fetchReferences(meterIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    const result = new Map<string, number>();
    for (const id of meterIds) {
      const reference = await this.fetchReference(id);
      if (reference !== null) {
        result.set(id, reference);
      }
    }
    return result;
  }
}
