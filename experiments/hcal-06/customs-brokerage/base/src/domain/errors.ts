export class DomainError extends Error {}

export class ShipmentNotFoundError extends DomainError {
  constructor(shipmentId: string) {
    super(`shipment ${shipmentId} not found`);
  }
}

export class AlreadyFiledError extends DomainError {
  constructor(shipmentId: string) {
    super(`shipment ${shipmentId} already has a customs entry`);
  }
}

export class FilingUnavailableError extends DomainError {}
