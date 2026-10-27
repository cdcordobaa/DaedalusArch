import { TenancyError } from '../errors/TenancyError';
import type { Party } from './Party';
import type { SignatureRequest } from './SignatureRequest';
import { Signing, SIGNING_LINK_DAYS } from './Signing';
import type { SigningOutcome } from './SigningOutcome';

export type AgreementStatus = 'draft' | 'out for signature' | 'signed' | 'declined' | 'expired';

/** A tenancy agreement between one landlord and one to four tenants, for a monthly rent from a start date. */
export class Agreement {
  private currentSigning: Signing | undefined;
  private declinedWith: { readonly by: string; readonly reason: string } | undefined;

  private constructor(
    readonly id: string,
    readonly address: string,
    readonly landlord: Party,
    readonly tenants: readonly Party[],
    readonly monthlyRent: number,
    readonly startsOn: string,
    private currentStatus: AgreementStatus,
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

  get signing(): Signing | undefined {
    return this.currentSigning;
  }

  get declined(): { readonly by: string; readonly reason: string } | undefined {
    return this.declinedWith;
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

  /** A draft, declined or expired agreement may be sent; one out for signature or signed may not. */
  ensureSendable(): void {
    if (this.currentStatus === 'out for signature') throw new TenancyError('This agreement is already out for signature.');
    if (this.currentStatus === 'signed') throw new TenancyError('This agreement is already signed.');
  }

  signatureRequest(): SignatureRequest {
    return { subject: `Tenancy agreement: ${this.address}`, document: this.text(), signers: this.tenants, copyTo: this.landlord, validForDays: SIGNING_LINK_DAYS };
  }

  /** A new signing starts; nothing of an earlier one carries over. */
  markSent(ref: string, sentAt: Date): void {
    this.ensureSendable();
    this.currentSigning = Signing.started(ref, sentAt);
    this.declinedWith = undefined;
    this.currentStatus = 'out for signature';
  }

  isAwaiting(signingRef: string): boolean {
    return this.currentStatus === 'out for signature' && this.currentSigning?.ref === signingRef;
  }

  /** Applies how the current signing ended; anything else (another signing, a finished agreement) changes nothing. */
  record(signingRef: string, outcome: SigningOutcome): void {
    if (!this.isAwaiting(signingRef)) return;
    if (outcome.kind === 'declined') this.declinedWith = { by: outcome.by, reason: outcome.reason };
    this.currentStatus = outcome.kind;
  }

  isReminderDue(now: Date): boolean {
    return this.currentStatus === 'out for signature' && this.currentSigning !== undefined && this.currentSigning.isReminderDue(now);
  }

  markReminded(at: Date): void {
    if (this.currentSigning === undefined) throw new TenancyError('This agreement has not been sent for signature.');
    this.currentSigning = this.currentSigning.reminded(at);
  }
}
