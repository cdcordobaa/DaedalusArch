import { DomainError } from "../../shared/errors.js";
import {
  decideIntake,
  newWeighing,
  type ChipWeighing,
  type IntakeDecision,
  type SugarReading,
  type Weighing,
} from "../domain/bin-intake.js";
import type {
  IntakeRepository,
  PickedBinLookup,
  RfidLinkRepository,
  UnlinkedWeighingRepository,
  VarietyRules,
  WeighingRepository,
} from "../domain/ports.js";

export class CellarService {
  constructor(
    private readonly weighings: WeighingRepository,
    private readonly intakes: IntakeRepository,
    private readonly picked: PickedBinLookup,
    private readonly rules: VarietyRules,
    private readonly rfid: RfidLinkRepository,
    private readonly unlinked: UnlinkedWeighingRepository,
    private readonly today: () => string = () => new Date().toISOString().slice(0, 10),
  ) {}

  /** A bin already weighed ignores further weighings (weighbridge resends); returns the weighing that counts. */
  recordWeighing(w: Weighing): Weighing {
    const existing = this.weighings.latest(w.tag);
    if (existing) return existing;
    this.weighings.save(w);
    return w;
  }

  /** Cellar staff correction: replaces the bin's weight, including in intake decisions already made. */
  correctWeighing(tag: number, grossKg: number, weighedAt: string = new Date().toISOString()): Weighing {
    const w = newWeighing(tag, grossKg, weighedAt);
    this.weighings.replaceForTag(w);
    for (const d of this.intakes.list()) if (d.tag === tag) this.intakes.save({ ...d, grossKg });
    return w;
  }

  /** Accepts a chip-identified weighing: stored as a normal weighing if the chip is linked, else held until it is. */
  recordChipWeighing(c: ChipWeighing): void {
    if (this.weighings.hasRef(c.source, c.ref) || this.unlinked.has(c.source, c.ref)) return;
    const tag = this.rfid.find(c.chip);
    if (tag === undefined) {
      this.unlinked.add(c);
      return;
    }
    if (this.weighings.latest(tag)) return;
    this.weighings.save({ ...newWeighing(tag, c.grossKg, c.weighedAt), source: c.source, sourceRef: c.ref });
  }

  /** Links an RFID chip to a bin tag and releases any weighings that were waiting for it. */
  linkRfid(chip: string, tag: number): void {
    if (!Number.isInteger(tag) || tag <= 0) throw new DomainError("tag must be a positive integer");
    this.rfid.link(chip, tag);
    for (const w of this.unlinked.takeForChip(chip)) this.recordChipWeighing(w);
  }
  listRfidLinks(): Record<string, number> {
    return this.rfid.list();
  }
  listUnlinkedWeighings(): ChipWeighing[] {
    return this.unlinked.list();
  }

  /** Records the sugar level and decides whether the bin is accepted or rejected. */
  recordSugar(tag: number, brix: number, date: string = this.today()): IntakeDecision {
    if (!Number.isInteger(tag) || tag <= 0) throw new DomainError("tag must be a positive integer");
    if (brix < 0) throw new DomainError("brix must not be negative");
    const reading: SugarReading = { tag, date, brix };
    const picked = this.picked.find(date, tag);
    const min = picked ? this.rules.minimumBrix(picked.grapeVariety) : undefined;
    const decision = decideIntake(reading, picked, min, this.weighings.latest(tag));
    this.intakes.save(decision);
    return decision;
  }

  setMinimumBrix(variety: string, brix: number): void {
    if (brix < 0) throw new DomainError("minimumBrix must not be negative");
    this.rules.setMinimumBrix(variety, brix);
  }
  listRules(): Record<string, number> {
    return this.rules.list();
  }
  findIntake(date: string, tag: number): IntakeDecision | undefined {
    return this.intakes.find(date, tag);
  }
  latestWeighing(tag: number): Weighing | undefined {
    return this.weighings.latest(tag);
  }
  listWeighings(): Weighing[] {
    return this.weighings.list();
  }
  listIntakes(): IntakeDecision[] {
    return this.intakes.list();
  }
}
