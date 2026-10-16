import { Booking, DomainError } from '../entities/market';

export function assertCanBook(existing: Booking[], pitchId: string, vendorId: string): void {
  if (existing.some((b) => b.pitchId === pitchId)) throw new DomainError('pitch already booked for this market day');
  if (existing.some((b) => b.vendorId === vendorId)) throw new DomainError('vendor already holds a pitch on this market day');
}
