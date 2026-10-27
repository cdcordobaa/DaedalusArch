export class DomainError extends Error {
  constructor(readonly code: string, message: string, readonly httpStatus: number = 400) {
    super(message);
    this.name = new.target.name;
  }
}

export class MeterNotFoundError extends DomainError {
  constructor(id: string) {
    super("METER_NOT_FOUND", `meter ${id} not found`, 404);
  }
}

export class InvalidReadingError extends DomainError {
  constructor(reason: string) {
    super("INVALID_READING", reason);
  }
}

export class TariffNotFoundError extends DomainError {
  constructor(id: string) {
    super("TARIFF_NOT_FOUND", `tariff ${id} not found`, 404);
  }
}
