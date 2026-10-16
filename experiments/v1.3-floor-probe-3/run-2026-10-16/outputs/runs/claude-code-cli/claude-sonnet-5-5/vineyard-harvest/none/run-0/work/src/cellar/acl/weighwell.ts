import { DomainError } from "../../shared/errors.js";
import type { ChipWeighing } from "../domain/bin-intake.js";
import type { WeighingBatch, WeighWellSource } from "../domain/ports.js";

export const WEIGHWELL = "weighwell";

/** Translates one WeighWell record (RFID chip, weight in tenths of a kg) into a cellar ChipWeighing. */
export function chipWeighingFromWeighWell(rec: unknown): ChipWeighing {
  if (typeof rec !== "object" || rec === null) throw new DomainError("weighwell record must be an object");
  const r = rec as Record<string, unknown>;
  const id = typeof r.id === "number" || typeof r.id === "string" ? String(r.id) : "";
  if (id === "") throw new DomainError("weighwell id is missing");
  const chip = typeof r.rfid === "number" || typeof r.rfid === "string" ? String(r.rfid).trim() : "";
  if (chip === "") throw new DomainError("weighwell rfid is missing");
  const tenths = r.weightTenthsKg;
  if (typeof tenths !== "number" || !Number.isFinite(tenths)) throw new DomainError("weightTenthsKg must be a number");
  if (typeof r.weighedAt !== "string" || Number.isNaN(Date.parse(r.weighedAt))) {
    throw new DomainError("weighedAt must be an ISO timestamp string");
  }
  return {
    source: WEIGHWELL,
    ref: id,
    chip,
    grossKg: tenths / 10,
    weighedAt: new Date(r.weighedAt).toISOString(),
  };
}

/** HTTP client for the WeighWell API: GET {baseUrl}/weighings?after=<cursor> -> { weighings: [...], cursor }. */
export class WeighWellClient implements WeighWellSource {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
  ) {}

  async fetchNew(cursor: string | undefined): Promise<WeighingBatch> {
    const url = new URL("weighings", this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`);
    if (cursor !== undefined) url.searchParams.set("after", cursor);
    const res = await fetch(url, this.apiKey ? { headers: { Authorization: `Bearer ${this.apiKey}` } } : {});
    if (!res.ok) throw new Error(`WeighWell responded ${res.status}`);
    const body = (await res.json()) as { weighings?: unknown; cursor?: unknown };
    if (!Array.isArray(body.weighings)) throw new Error("WeighWell response has no weighings array");
    const weighings: ChipWeighing[] = [];
    for (const rec of body.weighings) {
      try {
        weighings.push(chipWeighingFromWeighWell(rec));
      } catch (e) {
        console.error("skipping bad WeighWell record", e);
      }
    }
    return { weighings, cursor: typeof body.cursor === "string" ? body.cursor : cursor };
  }
}
