export type ChargeOutcome =
  | 'paid'
  | 'insufficient-funds'
  | 'card-expired'
  | 'fraud-suspected'
  | 'under-review'
  | 'unavailable';
