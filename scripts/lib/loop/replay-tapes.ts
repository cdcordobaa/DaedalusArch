/**
 * Recorded edit tapes of the loop replay (`replay.ts`): what a scripted agent writes, step by step, for three of the
 * pilot tasks (`experiments/loop-pilot/pilot-tasks.json`). Written by hand; no model produced them.
 *
 * Each tape has the task's 4 steps. Some steps are scripted to introduce exactly one blocking violation, and each
 * such step carries the scripted fix:
 * - `market-vendors` (Clean, `specs/clean-arch.yaml`): step 2 makes a domain file import an infrastructure module
 *   (FF-S01 dependency-direction); step 3 carries the fix (a domain port the infrastructure client implements).
 * - `shelter-adoptions` (Hexagonal, `presets/hexagonal.yaml`): step 3 makes a domain file import an outbound adapter;
 *   step 4 carries the fix (an application port).
 * - `relief-volunteers` (DDD, spec inferred by the ISE from step 1 and frozen): step 2 makes an application file of
 *   one context import the other context's domain (FF-DS02 context-isolation); step 3 carries the fix (its public API).
 * Every other step stays clean. The fix of step k is merged into step k+1's edits (`tape`), so the `none` arm, which
 * never sees feedback, still clears the violation one step later, and the other arms re-apply identical content.
 *
 * Edits are whole-file writes (`null` deletes). The code is small but type-checks under the E1 strict tsconfig.
 */
import type { ReplayStep, ReplayTape } from './replay.js';

type Edits = Readonly<Record<string, string | null>>;

interface RawStep {
  readonly edits: Edits;
  readonly violating?: { readonly why: string; readonly fix: Edits };
}

/** Builds a tape: the fix of each violating step is also written at the next step (before that step's own edits). */
export function tape(taskId: string, raw: readonly RawStep[]): ReplayTape {
  const steps: ReplayStep[] = raw.map((s, i) => {
    const prev = i > 0 ? raw[i - 1]?.violating?.fix : undefined;
    const edits = prev !== undefined ? { ...prev, ...s.edits } : s.edits;
    return s.violating !== undefined ? { edits, violating: s.violating } : { edits };
  });
  return { taskId, steps };
}

const lines = (...l: string[]): string => `${l.join('\n')}\n`;

// ── market-vendors (Clean) ──────────────────────────────────────────────────────────────────────────────────────

const MV_SETTLEMENT_CLEAN = lines(
  "import type { PayoutPort } from './payout-port';",
  '',
  'export interface SettlementLine {',
  '  readonly vendorId: string;',
  '  readonly salesCents: number;',
  '  readonly feesCents: number;',
  '}',
  '',
  'export function payoutCents(line: SettlementLine, commissionRate: number): number {',
  '  return Math.max(0, line.salesCents - Math.round(line.salesCents * commissionRate) - line.feesCents);',
  '}',
  '',
  'export function settle(lines: readonly SettlementLine[], rate: number, payouts: PayoutPort): number {',
  '  let total = 0;',
  '  for (const l of lines) {',
  '    const amount = payoutCents(l, rate);',
  '    payouts.pay(l.vendorId, amount);',
  '    total += amount;',
  '  }',
  '  return total;',
  '}',
);

const MARKET_VENDORS = tape('market-vendors', [
  {
    edits: {
      'src/domain/pitch.ts': lines(
        'export interface Pitch {',
        '  readonly number: number;',
        "  readonly size: 'small' | 'large';",
        '  readonly power: boolean;',
        '}',
      ),
      'src/domain/booking.ts': lines(
        'export interface Booking {',
        '  readonly vendorId: string;',
        '  readonly marketDay: string;',
        '  readonly pitchNumber: number;',
        '}',
        '',
        'export function conflicts(a: Booking, b: Booking): boolean {',
        '  if (a.marketDay !== b.marketDay) return false;',
        '  return a.pitchNumber === b.pitchNumber || a.vendorId === b.vendorId;',
        '}',
      ),
      'src/domain/booking-repository.ts': lines(
        "import type { Booking } from './booking';",
        '',
        'export interface BookingRepository {',
        '  forDay(marketDay: string): readonly Booking[];',
        '  save(booking: Booking): void;',
        '}',
      ),
      'src/application/book-pitch.ts': lines(
        "import { conflicts } from '../domain/booking';",
        "import type { Booking } from '../domain/booking';",
        "import type { BookingRepository } from '../domain/booking-repository';",
        '',
        'export class BookPitch {',
        '  constructor(private readonly bookings: BookingRepository) {}',
        '',
        '  execute(booking: Booking): boolean {',
        '    if (this.bookings.forDay(booking.marketDay).some((b) => conflicts(b, booking))) return false;',
        '    this.bookings.save(booking);',
        '    return true;',
        '  }',
        '}',
      ),
      'src/infrastructure/in-memory-booking-repository.ts': lines(
        "import type { Booking } from '../domain/booking';",
        "import type { BookingRepository } from '../domain/booking-repository';",
        '',
        'export class InMemoryBookingRepository implements BookingRepository {',
        '  private readonly rows: Booking[] = [];',
        '',
        '  forDay(marketDay: string): readonly Booking[] {',
        '    return this.rows.filter((b) => b.marketDay === marketDay);',
        '  }',
        '',
        '  save(booking: Booking): void {',
        '    this.rows.push(booking);',
        '  }',
        '}',
      ),
    },
  },
  {
    // Violation: the domain settlement calls the infrastructure payout client directly.
    edits: {
      'src/infrastructure/payout-client.ts': lines(
        'export class PayoutClient {',
        '  readonly sent: { vendorId: string; cents: number }[] = [];',
        '',
        '  pay(vendorId: string, cents: number): void {',
        '    this.sent.push({ vendorId, cents });',
        '  }',
        '}',
      ),
      'src/domain/settlement.ts': lines(
        "import { PayoutClient } from '../infrastructure/payout-client';",
        '',
        'export interface SettlementLine {',
        '  readonly vendorId: string;',
        '  readonly salesCents: number;',
        '  readonly feesCents: number;',
        '}',
        '',
        'export function payoutCents(line: SettlementLine, commissionRate: number): number {',
        '  return Math.max(0, line.salesCents - Math.round(line.salesCents * commissionRate) - line.feesCents);',
        '}',
        '',
        'export function settle(lines: readonly SettlementLine[], rate: number, payouts: { pay(vendorId: string, cents: number): void } = new PayoutClient()): number {',
        '  let total = 0;',
        '  for (const l of lines) {',
        '    const amount = payoutCents(l, rate);',
        '    payouts.pay(l.vendorId, amount);',
        '    total += amount;',
        '  }',
        '  return total;',
        '}',
      ),
      'src/application/settle-market-day.ts': lines(
        "import { settle } from '../domain/settlement';",
        "import type { SettlementLine } from '../domain/settlement';",
        "import type { PayoutPort } from '../domain/payout-port';",
        '',
        'export class SettleMarketDay {',
        '  constructor(private readonly payouts: PayoutPort) {}',
        '',
        '  execute(lines: readonly SettlementLine[], rate = 0.05): number {',
        '    return settle(lines, rate, this.payouts);',
        '  }',
        '}',
      ),
      'src/domain/payout-port.ts': lines('export interface PayoutPort {', '  pay(vendorId: string, cents: number): void;', '}'),
    },
    violating: {
      why: 'src/domain/settlement.ts imports src/infrastructure/payout-client.ts (domain -> infrastructure)',
      fix: {
        'src/domain/settlement.ts': MV_SETTLEMENT_CLEAN,
        'src/infrastructure/payout-client.ts': lines(
          "import type { PayoutPort } from '../domain/payout-port';",
          '',
          'export class PayoutClient implements PayoutPort {',
          '  readonly sent: { vendorId: string; cents: number }[] = [];',
          '',
          '  pay(vendorId: string, cents: number): void {',
          '    this.sent.push({ vendorId, cents });',
          '  }',
          '}',
        ),
      },
    },
  },
  {
    edits: {
      'src/domain/card-sale.ts': lines(
        'export interface CardSale {',
        '  readonly vendorId: string;',
        '  readonly marketDay: string;',
        '  readonly cents: number;',
        "  readonly provider: 'paylane' | 'tillwave';",
        '}',
      ),
      'src/application/record-card-sale.ts': lines(
        "import type { CardSale } from '../domain/card-sale';",
        '',
        'export class RecordCardSale {',
        '  private readonly sales: CardSale[] = [];',
        '',
        '  execute(sale: CardSale): void {',
        '    if (sale.cents > 0) this.sales.push(sale);',
        '  }',
        '',
        '  forDay(marketDay: string): readonly CardSale[] {',
        '    return this.sales.filter((s) => s.marketDay === marketDay);',
        '  }',
        '}',
      ),
      'src/infrastructure/tillwave-poller.ts': lines(
        "import type { CardSale } from '../domain/card-sale';",
        '',
        'export function fromTillWave(merchantToVendor: ReadonlyMap<string, string>, row: { merchant: string; day: string; cents: number }): CardSale | null {',
        '  const vendorId = merchantToVendor.get(row.merchant);',
        "  return vendorId === undefined ? null : { vendorId, marketDay: row.day, cents: row.cents, provider: 'tillwave' };",
        '}',
      ),
    },
  },
  {
    edits: {
      'src/domain/audit-entry.ts': lines(
        'export interface AuditEntry {',
        '  readonly actor: string;',
        '  readonly at: string;',
        '  readonly entity: string;',
        '  readonly before: string | null;',
        '  readonly after: string | null;',
        '}',
      ),
      'src/application/list-audit-log.ts': lines(
        "import type { AuditEntry } from '../domain/audit-entry';",
        '',
        'export class ListAuditLog {',
        '  constructor(private readonly entries: () => readonly AuditEntry[]) {}',
        '',
        '  execute(marketDay: string): readonly AuditEntry[] {',
        '    return this.entries().filter((e) => e.entity.startsWith(`${marketDay}/`));',
        '  }',
        '}',
      ),
    },
  },
]);

// ── shelter-adoptions (Hexagonal) ───────────────────────────────────────────────────────────────────────────────

const SA_NOTIFICATION_CLEAN = lines(
  "export type Channel = 'email' | 'sms';",
  '',
  'export interface Notification {',
  '  readonly id: string;',
  '  readonly to: string;',
  '  readonly channel: Channel;',
  '  readonly text: string;',
  '}',
  '',
  'export function smsText(text: string): string {',
  '  return text.length <= 160 ? text : text.slice(0, 160);',
  '}',
);

const SHELTER_ADOPTIONS = tape('shelter-adoptions', [
  {
    edits: {
      'src/domain/animal.ts': lines(
        "export type AnimalStatus = 'intake' | 'ready' | 'adopted';",
        '',
        'export interface Animal {',
        '  readonly id: string;',
        '  readonly species: string;',
        '  readonly name: string;',
        '  readonly status: AnimalStatus;',
        '}',
      ),
      'src/domain/application.ts': lines(
        "export type ApplicationStatus = 'open' | 'approved' | 'rejected';",
        '',
        'export interface AdoptionApplication {',
        '  readonly id: string;',
        '  readonly animalId: string;',
        '  readonly status: ApplicationStatus;',
        '}',
      ),
      'src/application/ports/animal-store.ts': lines(
        "import type { Animal } from '../../domain/animal';",
        "import type { AdoptionApplication } from '../../domain/application';",
        '',
        'export interface AnimalStore {',
        '  animal(id: string): Animal | undefined;',
        '  saveAnimal(animal: Animal): void;',
        '  applicationsFor(animalId: string): readonly AdoptionApplication[];',
        '  saveApplication(application: AdoptionApplication): void;',
        '}',
      ),
      'src/application/approve-application.ts': lines(
        "import type { AdoptionApplication } from '../domain/application';",
        "import type { AnimalStore } from './ports/animal-store';",
        '',
        'export class ApproveApplication {',
        '  constructor(private readonly store: AnimalStore) {}',
        '',
        '  execute(approved: AdoptionApplication): void {',
        '    const animal = this.store.animal(approved.animalId);',
        "    if (animal === undefined || animal.status !== 'ready') return;",
        "    this.store.saveAnimal({ ...animal, status: 'adopted' });",
        '    for (const a of this.store.applicationsFor(animal.id)) {',
        "      this.store.saveApplication({ ...a, status: a.id === approved.id ? 'approved' : 'rejected' });",
        '    }',
        '  }',
        '}',
      ),
      'src/adapters/outbound/in-memory-animal-store.ts': lines(
        "import type { Animal } from '../../domain/animal';",
        "import type { AdoptionApplication } from '../../domain/application';",
        "import type { AnimalStore } from '../../application/ports/animal-store';",
        '',
        'export class InMemoryAnimalStore implements AnimalStore {',
        '  private readonly animals = new Map<string, Animal>();',
        '  private readonly applications = new Map<string, AdoptionApplication>();',
        '',
        '  animal(id: string): Animal | undefined {',
        '    return this.animals.get(id);',
        '  }',
        '',
        '  saveAnimal(animal: Animal): void {',
        '    this.animals.set(animal.id, animal);',
        '  }',
        '',
        '  applicationsFor(animalId: string): readonly AdoptionApplication[] {',
        '    return [...this.applications.values()].filter((a) => a.animalId === animalId);',
        '  }',
        '',
        '  saveApplication(application: AdoptionApplication): void {',
        '    this.applications.set(application.id, application);',
        '  }',
        '}',
      ),
      'src/adapters/inbound/applications-handler.ts': lines(
        "import type { ApproveApplication } from '../../application/approve-application';",
        '',
        'export function approveHandler(useCase: ApproveApplication) {',
        '  return (body: { id: string; animalId: string }): number => {',
        "    useCase.execute({ id: body.id, animalId: body.animalId, status: 'open' });",
        '    return 204;',
        '  };',
        '}',
      ),
    },
  },
  {
    edits: {
      'src/domain/placement.ts': lines(
        'export interface Placement {',
        '  readonly animalId: string;',
        '  readonly carerId: string;',
        '  readonly ended: boolean;',
        '}',
        '',
        'export function hasRoom(capacity: number, placements: readonly Placement[]): boolean {',
        '  return placements.filter((p) => !p.ended).length < capacity;',
        '}',
      ),
      'src/application/place-animal.ts': lines(
        "import { hasRoom } from '../domain/placement';",
        "import type { Placement } from '../domain/placement';",
        '',
        'export class PlaceAnimal {',
        '  private readonly placements: Placement[] = [];',
        '',
        '  execute(animalId: string, carerId: string, capacity: number): boolean {',
        '    const current = this.placements.filter((p) => p.carerId === carerId);',
        '    if (!hasRoom(capacity, current)) return false;',
        '    this.placements.push({ animalId, carerId, ended: false });',
        '    return true;',
        '  }',
        '}',
      ),
    },
  },
  {
    // Violation: the domain notification sends through the outbound TextBridge adapter.
    edits: {
      'src/adapters/outbound/textbridge-client.ts': lines(
        'export class TextBridgeClient {',
        '  readonly outbox: { to: string; text: string }[] = [];',
        '',
        '  send(to: string, text: string): string {',
        '    this.outbox.push({ to, text });',
        '    return `tb-${String(this.outbox.length)}`;',
        '  }',
        '}',
      ),
      'src/domain/notification.ts': lines(
        "import { TextBridgeClient } from '../adapters/outbound/textbridge-client';",
        '',
        "export type Channel = 'email' | 'sms';",
        '',
        'export interface Notification {',
        '  readonly id: string;',
        '  readonly to: string;',
        '  readonly channel: Channel;',
        '  readonly text: string;',
        '}',
        '',
        'export function smsText(text: string): string {',
        '  return text.length <= 160 ? text : text.slice(0, 160);',
        '}',
        '',
        'export function sendSms(client: TextBridgeClient, n: Notification): string {',
        '  return client.send(n.to, smsText(n.text));',
        '}',
      ),
      'src/application/ports/sms-sender.ts': lines('export interface SmsSender {', '  send(to: string, text: string): string;', '}'),
    },
    violating: {
      why: 'src/domain/notification.ts imports src/adapters/outbound/textbridge-client.ts (core -> outbound adapter)',
      fix: {
        'src/domain/notification.ts': SA_NOTIFICATION_CLEAN,
        'src/application/send-notification.ts': lines(
          "import { smsText } from '../domain/notification';",
          "import type { Notification } from '../domain/notification';",
          "import type { SmsSender } from './ports/sms-sender';",
          '',
          'export class SendNotification {',
          '  constructor(private readonly sms: SmsSender) {}',
          '',
          '  execute(n: Notification): string {',
          '    return this.sms.send(n.to, smsText(n.text));',
          '  }',
          '}',
        ),
        'src/adapters/outbound/textbridge-client.ts': lines(
          "import type { SmsSender } from '../../application/ports/sms-sender';",
          '',
          'export class TextBridgeClient implements SmsSender {',
          '  readonly outbox: { to: string; text: string }[] = [];',
          '',
          '  send(to: string, text: string): string {',
          '    this.outbox.push({ to, text });',
          '    return `tb-${String(this.outbox.length)}`;',
          '  }',
          '}',
        ),
      },
    },
  },
  {
    edits: {
      'src/domain/audit-record.ts': lines(
        'export interface AuditRecord {',
        '  readonly actor: string;',
        '  readonly at: string;',
        '  readonly animalId: string;',
        '  readonly before: string | null;',
        '  readonly after: string | null;',
        '}',
      ),
      'src/application/list-audit-trail.ts': lines(
        "import type { AuditRecord } from '../domain/audit-record';",
        '',
        'export class ListAuditTrail {',
        '  constructor(private readonly records: () => readonly AuditRecord[]) {}',
        '',
        '  execute(animalId: string): readonly AuditRecord[] {',
        '    return this.records().filter((r) => r.animalId === animalId);',
        '  }',
        '}',
      ),
    },
  },
]);

// ── relief-volunteers (DDD, ISE-frozen spec) ────────────────────────────────────────────────────────────────────

const ASSIGN_VOLUNTEER_CLEAN = lines(
  "import { qualifies } from '../domain/shift/assignment';",
  "import type { Shift } from '../domain/shift/shift';",
  "import type { Volunteer } from '../../registry';",
  '',
  'export class AssignVolunteer {',
  '  execute(shift: Shift, volunteer: Volunteer): { shiftId: string; volunteerId: string } | null {',
  '    return qualifies(volunteer.skills, shift.needs) ? { shiftId: shift.id, volunteerId: volunteer.id } : null;',
  '  }',
  '}',
);

const RELIEF_VOLUNTEERS = tape('relief-volunteers', [
  {
    // One folder per aggregate under each context's domain folder: the ISE infers an aggregate only from such a folder.
    edits: {
      'src/registry/domain/volunteer/volunteer.ts': lines(
        'export class Volunteer {',
        '  constructor(',
        '    readonly id: string,',
        '    readonly name: string,',
        '    readonly skills: readonly string[],',
        '  ) {}',
        '',
        '  has(skill: string): boolean {',
        '    return this.skills.includes(skill);',
        '  }',
        '}',
      ),
      'src/registry/domain/volunteer/volunteer-repository.ts': lines(
        "import type { Volunteer } from './volunteer';",
        '',
        'export interface VolunteerRepository {',
        '  byId(id: string): Volunteer | undefined;',
        '  save(volunteer: Volunteer): void;',
        '}',
      ),
      'src/registry/application/register-volunteer.ts': lines(
        "import { Volunteer } from '../domain/volunteer/volunteer';",
        "import type { VolunteerRepository } from '../domain/volunteer/volunteer-repository';",
        '',
        'export class RegisterVolunteer {',
        '  constructor(private readonly volunteers: VolunteerRepository) {}',
        '',
        '  execute(id: string, name: string, skills: readonly string[]): Volunteer {',
        '    const volunteer = new Volunteer(id, name, skills);',
        '    this.volunteers.save(volunteer);',
        '    return volunteer;',
        '  }',
        '}',
      ),
      'src/registry/infrastructure/in-memory-volunteer-repository.ts': lines(
        "import type { Volunteer } from '../domain/volunteer/volunteer';",
        "import type { VolunteerRepository } from '../domain/volunteer/volunteer-repository';",
        '',
        'export class InMemoryVolunteerRepository implements VolunteerRepository {',
        '  private readonly rows = new Map<string, Volunteer>();',
        '',
        '  byId(id: string): Volunteer | undefined {',
        '    return this.rows.get(id);',
        '  }',
        '',
        '  save(volunteer: Volunteer): void {',
        '    this.rows.set(volunteer.id, volunteer);',
        '  }',
        '}',
      ),
      'src/registry/index.ts': lines(
        "export type { Volunteer } from './domain/volunteer/volunteer';",
        "export { RegisterVolunteer } from './application/register-volunteer';",
      ),
      'src/deployment/domain/shift/shift.ts': lines(
        'export class Shift {',
        '  constructor(',
        '    readonly id: string,',
        '    readonly site: string,',
        '    readonly needs: readonly string[],',
        '  ) {}',
        '}',
      ),
      'src/deployment/domain/shift/shift-repository.ts': lines(
        "import type { Shift } from './shift';",
        '',
        'export interface ShiftRepository {',
        '  byId(id: string): Shift | undefined;',
        '  save(shift: Shift): void;',
        '}',
      ),
      'src/deployment/application/plan-shift.ts': lines(
        "import { Shift } from '../domain/shift/shift';",
        "import type { ShiftRepository } from '../domain/shift/shift-repository';",
        '',
        'export class PlanShift {',
        '  constructor(private readonly shifts: ShiftRepository) {}',
        '',
        '  execute(id: string, site: string, needs: readonly string[]): Shift {',
        '    const shift = new Shift(id, site, needs);',
        '    this.shifts.save(shift);',
        '    return shift;',
        '  }',
        '}',
      ),
      'src/deployment/index.ts': lines("export type { Shift } from './domain/shift/shift';", "export { PlanShift } from './application/plan-shift';"),
      'src/main.ts': lines(
        "import { RegisterVolunteer } from './registry';",
        "import { InMemoryVolunteerRepository } from './registry/infrastructure/in-memory-volunteer-repository';",
        '',
        'export const registerVolunteer = new RegisterVolunteer(new InMemoryVolunteerRepository());',
      ),
    },
  },
  {
    edits: {
      'src/deployment/domain/shift/assignment.ts': lines(
        'export function qualifies(skills: readonly string[], needs: readonly string[]): boolean {',
        '  return needs.every((n) => skills.includes(n));',
        '}',
      ),
      'src/deployment/acl/volunteer-skills.ts': lines(
        "import type { Volunteer } from '../../registry';",
        '',
        'export function skillsOf(volunteer: Volunteer): readonly string[] {',
        '  return volunteer.skills;',
        '}',
      ),
      'src/deployment/application/assign-volunteer.ts': lines(
        "import { qualifies } from '../domain/shift/assignment';",
        "import type { Shift } from '../domain/shift/shift';",
        "import type { Volunteer } from '../../registry/domain/volunteer/volunteer';",
        '',
        'export class AssignVolunteer {',
        '  execute(shift: Shift, volunteer: Volunteer): { shiftId: string; volunteerId: string } | null {',
        '    return qualifies(volunteer.skills, shift.needs) ? { shiftId: shift.id, volunteerId: volunteer.id } : null;',
        '  }',
        '}',
      ),
    },
    violating: {
      why: 'src/deployment/application/assign-volunteer.ts imports the registry context\'s domain directly (not through its public API or an ACL)',
      fix: {
        'src/deployment/application/assign-volunteer.ts': ASSIGN_VOLUNTEER_CLEAN,
      },
    },
  },
  {
    edits: {
      'src/registry/domain/volunteer/licence.ts': lines(
        'export interface Licence {',
        '  readonly kind: string;',
        '  readonly expires: string;',
        '}',
        '',
        'export function valid(licence: Licence, on: string): boolean {',
        '  return licence.expires >= on;',
        '}',
      ),
      'src/registry/application/check-licence.ts': lines(
        "import { valid } from '../domain/volunteer/licence';",
        "import type { Licence } from '../domain/volunteer/licence';",
        '',
        'export class CheckLicence {',
        '  execute(licences: readonly Licence[], kind: string, on: string): boolean {',
        '    return licences.some((l) => l.kind === kind && valid(l, on));',
        '  }',
        '}',
      ),
    },
  },
  {
    edits: {
      'src/deployment/application/impact-report.ts': lines(
        "import type { Shift } from '../domain/shift/shift';",
        '',
        'export function shiftsBySite(shifts: readonly Shift[]): ReadonlyMap<string, number> {',
        '  const out = new Map<string, number>();',
        '  for (const s of shifts) out.set(s.site, (out.get(s.site) ?? 0) + 1);',
        '  return out;',
        '}',
      ),
    },
  },
]);

/** The replay tapes, by task id. */
export const REPLAY_TAPES: readonly ReplayTape[] = Object.freeze([MARKET_VENDORS, SHELTER_ADOPTIONS, RELIEF_VOLUNTEERS]);
