export const ProductionStage = {
  Queued: 'queued',
  Checking: 'checking',
  OnPress: 'on-press',
  Finishing: 'finishing',
  Boxed: 'boxed',
  InTransit: 'in-transit',
  Arrived: 'arrived',
  Stopped: 'stopped',
} as const;

export type ProductionStage = (typeof ProductionStage)[keyof typeof ProductionStage];
