export interface GridOperatorPort {
  fetchReference(meterId: string): Promise<number | null>;
}
