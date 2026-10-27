export class DomainError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class MeterNotFoundError extends DomainError {
  constructor(id: string) {
    super("METER_NOT_FOUND", `meter ${id} not found`);
  }
}

export class InvalidReadingError extends DomainError {
  constructor(reason: string) {
    super("INVALID_READING", reason);
  }
}

export class TariffNotFoundError extends DomainError {
  constructor(id: string) {
    super("TARIFF_NOT_FOUND", `tariff ${id} not found`);
  }
}

export class InvalidPeriodError extends DomainError {
  constructor(days: number) {
    super("INVALID_PERIOD", `period of ${days} days is not valid`);
  }
}
