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

export class ReadingOutOfOrderError extends DomainError {
  constructor(reason: string) {
    super("READING_OUT_OF_ORDER", reason);
  }
}
