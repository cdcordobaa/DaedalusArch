import { DomainError } from "../../shared/errors.js";

export interface Weighing {
  readonly tag: number;
  readonly grossKg: number;
  readonly weighedAt: string; // ISO timestamp
  /** Set for weighings pulled from a weighbridge that identifies them; used to avoid counting one twice. */
  readonly source?: string;
  readonly sourceRef?: string;
}

/** A weighing identified by RFID chip, not yet resolved to a bin tag. Weight already in kg. */
export interface ChipWeighing {
  readonly source: string;
  readonly ref: string;
  readonly chip: string;
  readonly grossKg: number;
  readonly weighedAt: string;
}

export interface SugarReading {
  readonly tag: number;
  readonly date: string;
  readonly brix: number;
}

/** What the cellar needs to know about a bin from picking. */
export interface PickedBin {
  readonly tag: number;
  readonly date: string;
  readonly grapeVariety: string;
}

export interface IntakeDecision {
  readonly tag: number;
  readonly date: string;
  readonly status: "accepted" | "rejected";
  readonly reason?: string;
  readonly brix: number;
  readonly grossKg?: number;
}

export function newWeighing(tag: number, grossKg: number, weighedAt: string): Weighing {
  if (!Number.isInteger(tag) || tag <= 0) throw new DomainError("tag must be a positive integer");
  if (grossKg <= 0) throw new DomainError("grossKg must be positive");
  if (Number.isNaN(Date.parse(weighedAt))) throw new DomainError("time is not a valid timestamp");
  return { tag, grossKg, weighedAt };
}

/** Acceptance rule: recorded by picking that day and sugar at least the variety's minimum. */
export function decideIntake(
  reading: SugarReading,
  picked: PickedBin | undefined,
  minimumBrix: number | undefined,
  weighing: Weighing | undefined,
): IntakeDecision {
  const base = { tag: reading.tag, date: reading.date, brix: reading.brix, grossKg: weighing?.grossKg };
  if (!picked) {
    return { ...base, status: "rejected", reason: `bin ${reading.tag} was not recorded by picking on ${reading.date}` };
  }
  if (minimumBrix === undefined) {
    return { ...base, status: "rejected", reason: `no minimum sugar level defined for variety ${picked.grapeVariety}` };
  }
  if (reading.brix < minimumBrix) {
    return {
      ...base,
      status: "rejected",
      reason: `sugar level ${reading.brix} is below the minimum ${minimumBrix} for ${picked.grapeVariety}`,
    };
  }
  return { ...base, status: "accepted" };
}
