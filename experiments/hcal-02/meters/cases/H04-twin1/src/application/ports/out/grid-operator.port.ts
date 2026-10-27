export interface GridOperatorPort {
  fetchReference(meterId: string): Promise<number | null>;
  fetchReferences(meterIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
}
