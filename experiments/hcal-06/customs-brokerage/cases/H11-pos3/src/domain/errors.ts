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

export class FilingRejectedError extends DomainError {
  constructor(readonly code: 'HTS_INVALID' | 'BOND_INSUFFICIENT' | 'PORT_CLOSED') {
    super(`customs refused the filing: ${code}`);
  }
}
