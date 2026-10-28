import { InvalidRequest } from '../../domain/errors/LoungeErrors';
import { airportCode } from '../../domain/model/AirportCode';
import { localDate } from '../../domain/model/LocalDate';
import type { Pass } from '../../domain/model/Pass';
import type { PassSales } from '../ports/in/PassSales';
import type { PassStore } from '../ports/out/PassStore';

export class PassService implements PassSales {
  constructor(private readonly passes: PassStore) {}

  registerAirlinePass(holder: string, airline: string): string {
    const code = airline.trim().toUpperCase();
    if (!/^[A-Z0-9]{2}$/.test(code)) throw new InvalidRequest('airline must be a two-character code');
    return this.keep({ kind: 'airline', id: this.passes.nextId(), holder: holderName(holder), airline: code });
  }

  sellDayPass(holder: string, airport: string, date: string): string {
    return this.keep({ kind: 'day', id: this.passes.nextId(), holder: holderName(holder), airport: airportCode(airport), validOn: localDate(date) });
  }

  private keep(pass: Pass): string {
    this.passes.save(pass);
    return pass.id;
  }
}

function holderName(raw: string): string {
  if (raw.trim() === '') throw new InvalidRequest('a pass needs a holder');
  return raw.trim();
}
