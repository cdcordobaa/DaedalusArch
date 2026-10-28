import { TenancyError } from '../errors/TenancyError';
import type { Party } from './Party';

export type AgreementStatus = 'draft' | 'out for signature' | 'signed' | 'declined' | 'expired';

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_GAP_MS = 3 * DAY_MS;
const LINK_LIFETIME_MS = 14 * DAY_MS;
const MAX_REMINDERS = 2;

/** A tenancy agreement between one landlord and one to four tenants, for a monthly rent from a start date. */
export class Agreement {
  private constructor(
    readonly id: string,
    readonly address: string,
    readonly landlord: Party,
    readonly tenants: readonly Party[],
    readonly monthlyRent: number,
    readonly startsOn: string,
    private currentStatus: AgreementStatus,
    private currentSentAt?: Date,
    private currentEnvelopeId?: string,
    private currentDeclinedBy?: string,
    private currentReason?: string,
    private currentReminders: number = 0,
    private currentRemindedAt?: Date,
  ) {}

  static draft(id: string, address: string, landlord: Party, tenants: readonly Party[], monthlyRent: number, startsOn: string): Agreement {
    if (address.trim() === '') throw new TenancyError('An agreement needs the property address.');
    if (tenants.length < 1 || tenants.length > 4) throw new TenancyError('An agreement has one to four tenants.');
    if (new Set(tenants.map((t) => t.email)).size !== tenants.length) throw new TenancyError('Each tenant needs their own email address.');
    if (tenants.some((t) => t.email === landlord.email)) throw new TenancyError('The landlord cannot also be a tenant.');
    if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) throw new TenancyError('The monthly rent must be more than zero.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || Number.isNaN(Date.parse(startsOn))) throw new TenancyError('The start date is written YYYY-MM-DD.');
    return new Agreement(id, address.trim(), landlord, [...tenants], Math.round(monthlyRent * 100) / 100, startsOn, 'draft');
  }

  get status(): AgreementStatus {
    return this.currentStatus;
  }

  get sentAt(): Date | undefined {
    return this.currentSentAt;
  }

  get envelopeId(): string | undefined {
    return this.currentEnvelopeId;
  }

  get declinedBy(): string | undefined {
    return this.currentDeclinedBy;
  }

  /** Whether a reminder may go out at `now`: out for signature, link unexpired, spaced 3 days apart, at most 2. */
  isDueForReminder(now: Date): boolean {
    if (this.currentStatus !== 'out for signature' || this.currentSentAt === undefined) return false;
    if (this.currentReminders >= MAX_REMINDERS) return false;
    const sent = this.currentSentAt.getTime();
    if (now.getTime() >= sent + LINK_LIFETIME_MS) return false;
    const since = this.currentRemindedAt?.getTime() ?? sent;
    return now.getTime() >= since + REMINDER_GAP_MS;
  }

  recordReminder(at: Date): void {
    this.currentReminders += 1;
    this.currentRemindedAt = at;
  }

  get reason(): string | undefined {
    return this.currentReason;
  }

  /** Records a tenant declining; only an agreement still out for signature changes. */
  decline(tenantEmail: string, reason: string): void {
    if (this.currentStatus !== 'out for signature') return;
    const tenant = this.tenants.find((t) => t.email === tenantEmail.trim().toLowerCase());
    if (tenant === undefined) return;
    this.currentStatus = 'declined';
    this.currentDeclinedBy = tenant.email;
    this.currentReason = reason;
  }

  expire(): void {
    if (this.currentStatus === 'out for signature') this.currentStatus = 'expired';
  }

  complete(): void {
    if (this.currentStatus === 'out for signature') this.currentStatus = 'signed';
  }

  /** Refuses a send unless the agreement is a draft, or an earlier signing was declined or expired. */
  assertSendable(): void {
    if (this.currentStatus === 'out for signature') throw new TenancyError('This agreement is already out for signature.');
    if (this.currentStatus === 'signed') throw new TenancyError('This agreement is already signed.');
  }

  /** Starts a new signing; nothing of an earlier one carries over. */
  markSent(envelopeId: string, sentAt: Date): void {
    this.assertSendable();
    this.currentStatus = 'out for signature';
    this.currentEnvelopeId = envelopeId;
    this.currentSentAt = sentAt;
    this.currentDeclinedBy = undefined;
    this.currentReason = undefined;
    this.currentReminders = 0;
    this.currentRemindedAt = undefined;
  }

  /** The agreement as the parties read and sign it. */
  text(): string {
    return [
      'TENANCY AGREEMENT',
      `Property: ${this.address}`,
      `Landlord: ${this.landlord.name} <${this.landlord.email}>`,
      ...this.tenants.map((t, i) => `Tenant ${String(i + 1)}: ${t.name} <${t.email}>`),
      `Rent: GBP ${this.monthlyRent.toFixed(2)} per calendar month, from ${this.startsOn}.`,
    ].join('\n');
  }
}
