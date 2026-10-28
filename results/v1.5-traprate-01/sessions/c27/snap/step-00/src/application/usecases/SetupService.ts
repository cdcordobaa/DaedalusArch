import { airportCode } from '../../domain/model/AirportCode';
import { Lounge } from '../../domain/model/Lounge';
import { PartnerRule } from '../../domain/model/PartnerRule';
import type { LoungeSetup } from '../ports/in/LoungeSetup';
import type { LoungeStore } from '../ports/out/LoungeStore';
import type { PartnerStore } from '../ports/out/PartnerStore';

export class SetupService implements LoungeSetup {
  constructor(private readonly lounges: LoungeStore, private readonly partners: PartnerStore) {}

  openLounge(name: string, airport: string, capacity: number, partners: readonly string[]): string {
    const lounge = Lounge.open(this.lounges.nextId(), name, airportCode(airport), capacity, partners);
    this.lounges.save(lounge);
    return lounge.id;
  }

  addPartner(airline: string, guestAllowance: number): void {
    this.partners.save(PartnerRule.create(airline, guestAllowance));
  }
}
