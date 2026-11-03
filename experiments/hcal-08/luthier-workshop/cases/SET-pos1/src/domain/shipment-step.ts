export const SHIPMENT_STEPS = ['PICKING', 'KILNED', 'CRATED', 'FREIGHTED', 'HANDED', 'VOIDED'] as const;
export type ShipmentStep = (typeof SHIPMENT_STEPS)[number];
