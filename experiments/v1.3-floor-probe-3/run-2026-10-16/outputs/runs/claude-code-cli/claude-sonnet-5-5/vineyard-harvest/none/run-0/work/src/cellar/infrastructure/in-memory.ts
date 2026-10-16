import type { ChipWeighing, IntakeDecision, Weighing } from "../domain/bin-intake.js";
import type {
  IntakeRepository,
  RfidLinkRepository,
  UnlinkedWeighingRepository,
  VarietyRules,
  WeighingRepository,
} from "../domain/ports.js";

export class InMemoryRfidLinkRepository implements RfidLinkRepository {
  private readonly links = new Map<string, number>();
  link(chip: string, tag: number): void {
    this.links.set(chip, tag);
  }
  find(chip: string): number | undefined {
    return this.links.get(chip);
  }
  list(): Record<string, number> {
    return Object.fromEntries(this.links);
  }
}

export class InMemoryUnlinkedWeighingRepository implements UnlinkedWeighingRepository {
  private items: ChipWeighing[] = [];
  add(w: ChipWeighing): void {
    this.items.push(w);
  }
  has(source: string, ref: string): boolean {
    return this.items.some((w) => w.source === source && w.ref === ref);
  }
  takeForChip(chip: string): ChipWeighing[] {
    const taken = this.items.filter((w) => w.chip === chip);
    this.items = this.items.filter((w) => w.chip !== chip);
    return taken;
  }
  list(): ChipWeighing[] {
    return [...this.items];
  }
}

export class InMemoryWeighingRepository implements WeighingRepository {
  private readonly items: Weighing[] = [];
  save(w: Weighing): void {
    this.items.push(w);
  }
  replaceForTag(w: Weighing): void {
    for (let i = this.items.length - 1; i >= 0; i--) if (this.items[i]!.tag === w.tag) this.items.splice(i, 1);
    this.items.push(w);
  }
  hasRef(source: string, ref: string): boolean {
    return this.items.some((w) => w.source === source && w.sourceRef === ref);
  }
  latest(tag: number): Weighing | undefined {
    return this.items.filter((w) => w.tag === tag).sort((a, b) => Date.parse(b.weighedAt) - Date.parse(a.weighedAt))[0];
  }
  list(): Weighing[] {
    return [...this.items];
  }
}

export class InMemoryIntakeRepository implements IntakeRepository {
  private readonly items = new Map<string, IntakeDecision>();
  save(d: IntakeDecision): void {
    this.items.set(`${d.date}#${d.tag}`, d);
  }
  find(date: string, tag: number): IntakeDecision | undefined {
    return this.items.get(`${date}#${tag}`);
  }
  list(): IntakeDecision[] {
    return [...this.items.values()];
  }
}

export class InMemoryVarietyRules implements VarietyRules {
  private readonly rules = new Map<string, number>();
  private key(v: string): string {
    return v.trim().toLowerCase();
  }
  minimumBrix(variety: string): number | undefined {
    return this.rules.get(this.key(variety));
  }
  setMinimumBrix(variety: string, brix: number): void {
    this.rules.set(this.key(variety), brix);
  }
  list(): Record<string, number> {
    return Object.fromEntries(this.rules);
  }
}
