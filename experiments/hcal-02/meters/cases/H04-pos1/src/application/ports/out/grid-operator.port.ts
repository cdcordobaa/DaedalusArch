import type { GridcoResponse } from "gridco-sdk";

export interface GridOperatorPort {
  fetchReference(meterId: string): Promise<number | null>;
  fetchRaw(meterId: string): Promise<GridcoResponse>;
}
