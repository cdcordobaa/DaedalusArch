import { randomUUID } from "node:crypto";
import { DomainError, notFound } from "../../shared/errors.js";
import { assertWeekOpen, weekStartOf } from "../domain/pay.js";
import { newBlock, type Block } from "../domain/block.js";
import { newPicker, type Picker } from "../domain/picker.js";
import { PickingDay, type Bin } from "../domain/picking-day.js";
import type {
  ApprovedWeekRepository,
  BlockRepository,
  PayRulesRepository,
  PickerRepository,
  PickingDayRepository,
} from "../domain/repositories.js";

export class PickingService {
  constructor(
    private readonly pickers: PickerRepository,
    private readonly blocks: BlockRepository,
    private readonly days: PickingDayRepository,
    private readonly payRules: PayRulesRepository,
    private readonly approvals: ApprovedWeekRepository,
  ) {}

  registerPicker(name: string, phone: string, hourlyRate: number): Picker {
    const p = newPicker(randomUUID(), name, phone, hourlyRate);
    this.pickers.save(p);
    return p;
  }
  listPickers(): Picker[] {
    return this.pickers.list();
  }

  registerBlock(name: string, grapeVariety: string, areaHectares: number): Block {
    const b = newBlock(randomUUID(), name, grapeVariety, areaHectares);
    this.blocks.save(b);
    return b;
  }
  listBlocks(): Block[] {
    return this.blocks.list();
  }
  findBlock(id: string): Block | undefined {
    return this.blocks.find(id);
  }

  assignPicker(date: string, pickerId: string, blockId: string): void {
    if (!this.pickers.find(pickerId)) throw notFound("picker");
    if (!this.blocks.find(blockId)) throw notFound("block");
    const day = this.days.find(date) ?? new PickingDay(date);
    day.assign(pickerId, blockId);
    this.days.save(day);
  }

  findPicker(id: string): Picker | undefined {
    return this.pickers.find(id);
  }

  recordBin(date: string, tag: number, blockId: string, pickerId: string, binType?: string): Bin {
    if (!this.pickers.find(pickerId)) throw notFound("picker");
    if (!this.blocks.find(blockId)) throw notFound("block");
    if (binType !== undefined && !(binType in this.payRules.get().binTareKg)) {
      throw new DomainError(`unknown bin type ${binType}`);
    }
    assertWeekOpen(this.approvals.find(weekStartOf(date)), weekStartOf(date));
    const day = this.days.find(date) ?? new PickingDay(date);
    const bin = day.recordBin(tag, blockId, pickerId, binType);
    this.days.save(day);
    return bin;
  }

  getDay(date: string): { date: string; assignments: { blockId: string; pickerIds: string[] }[]; bins: Bin[] } {
    const day = this.days.find(date) ?? new PickingDay(date);
    return { date, assignments: day.listAssignments(), bins: day.listBins() };
  }

  findBin(date: string, tag: number): Bin | undefined {
    return this.days.find(date)?.findBin(tag);
  }
}
