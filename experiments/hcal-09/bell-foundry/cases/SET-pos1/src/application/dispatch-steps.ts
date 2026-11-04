export const DISPATCH_STEPS = ['QUEUED', 'POURED', 'ASSAYED', 'LOADED', 'LANDED', 'REJECTED'] as const;
export type DispatchStep = (typeof DISPATCH_STEPS)[number];
