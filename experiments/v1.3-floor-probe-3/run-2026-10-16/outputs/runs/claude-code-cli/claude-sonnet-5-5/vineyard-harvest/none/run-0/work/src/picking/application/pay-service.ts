import { DomainError, notFound } from "../../shared/errors.js";
import {
  ApprovedWeek,
  addDays,
  assertWeekOpen,
  binStatementLine,
  requireWeekStart,
  round2,
  weekDates,
  weekStartOf,
  type PayRules,
  type PayStatement,
} from "../domain/pay.js";
import { PickingDay } from "../domain/picking-day.js";
import type {
  ApprovedWeekRepository,
  BinOutcomeLookup,
  PayRulesRepository,
  PickingDayRepository,
} from "../domain/repositories.js";
import type { PickingService } from "./picking-service.js";

export class PayService {
  constructor(
    private readonly picking: PickingService,
    private readonly days: PickingDayRepository,
    private readonly rules: PayRulesRepository,
    private readonly approvals: ApprovedWeekRepository,
    private readonly outcomes: BinOutcomeLookup,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  getRules(): PayRules {
    return this.rules.get();
  }

  setPieceRate(ratePerKg: number): PayRules {
    if (ratePerKg < 0) throw new DomainError("pieceRatePerKg must not be negative");
    const r = { ...this.rules.get(), pieceRatePerKg: ratePerKg };
    this.rules.save(r);
    return r;
  }

  setBinTare(binType: string, tareKg: number): PayRules {
    if (tareKg < 0) throw new DomainError("tareKg must not be negative");
    const cur = this.rules.get();
    const r = { ...cur, binTareKg: { ...cur.binTareKg, [binType]: tareKg } };
    this.rules.save(r);
    return r;
  }

  recordHours(date: string, pickerId: string, hours: number): { date: string; pickerId: string; hours: number } {
    if (!this.picking.findPicker(pickerId)) throw notFound("picker");
    const weekStart = weekStartOf(date);
    assertWeekOpen(this.approvals.find(weekStart), weekStart);
    const day = this.days.find(date) ?? new PickingDay(date);
    day.setHours(pickerId, hours);
    this.days.save(day);
    return { date, pickerId, hours };
  }

  statement(pickerId: string, weekStart: string): PayStatement {
    requireWeekStart(weekStart);
    if (!this.picking.findPicker(pickerId)) throw notFound("picker");
    const approved = this.approvals.find(weekStart);
    if (approved) {
      const frozen = approved.statementFor(pickerId);
      if (frozen) return frozen;
      return { ...this.compute(pickerId, weekStart), approved: true };
    }
    return this.compute(pickerId, weekStart);
  }

  weekStatements(weekStart: string): PayStatement[] {
    requireWeekStart(weekStart);
    const approved = this.approvals.find(weekStart);
    if (approved) return approved.list();
    return this.activePickerIds(weekStart).map((id) => this.compute(id, weekStart));
  }

  /** Freezes the week's statements; they can never change afterwards. */
  approve(weekStart: string): { weekStart: string; approvedAt: string; statements: PayStatement[] } {
    requireWeekStart(weekStart);
    assertWeekOpen(this.approvals.find(weekStart), weekStart);
    const statements = this.activePickerIds(weekStart).map((id) => ({ ...this.compute(id, weekStart), approved: true }));
    const week = new ApprovedWeek(weekStart, this.now(), statements);
    this.approvals.save(week);
    return { weekStart, approvedAt: week.approvedAt, statements: week.list() };
  }

  private activePickerIds(weekStart: string): string[] {
    const ids = new Set<string>();
    for (const date of weekDates(weekStart)) {
      const day = this.days.find(date);
      if (!day) continue;
      for (const h of day.listHours()) ids.add(h.pickerId);
      for (const b of day.listBins()) ids.add(b.pickerId);
    }
    return [...ids].filter((id) => this.picking.findPicker(id)).sort();
  }

  private compute(pickerId: string, weekStart: string): PayStatement {
    const picker = this.picking.findPicker(pickerId)!;
    const rules = this.rules.get();
    const days = weekDates(weekStart).map((date) => ({ date, hours: this.days.find(date)?.hoursOf(pickerId) ?? 0 }));
    const bins = weekDates(weekStart).flatMap((date) =>
      (this.days.find(date)?.listBins() ?? [])
        .filter((b) => b.pickerId === pickerId)
        .map((b) => binStatementLine(date, b.tag, b.binType, this.outcomes.find(date, b.tag), rules)),
    );
    const totalHours = days.reduce((s, d) => s + d.hours, 0);
    const hoursPay = round2(totalHours * picker.hourlyRate);
    const piecePay = round2(bins.reduce((s, b) => s + b.pay, 0));
    const acceptedNetKg = bins.filter((b) => b.status === "accepted").reduce((s, b) => s + (b.netKg ?? 0), 0);
    return {
      pickerId,
      pickerName: picker.name,
      weekStart,
      weekEnd: addDays(weekStart, 6),
      hourlyRate: picker.hourlyRate,
      pieceRatePerKg: rules.pieceRatePerKg,
      days,
      totalHours,
      hoursPay,
      bins,
      acceptedNetKg,
      piecePay,
      total: round2(hoursPay + piecePay),
      approved: false,
    };
  }
}
