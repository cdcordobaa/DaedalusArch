export type DeliverableKind = 'orthomosaic' | 'point-cloud' | 'inspection-report';

export class Deliverable {
  constructor(
    readonly kind: DeliverableKind,
    readonly format: string,
  ) {}
}
