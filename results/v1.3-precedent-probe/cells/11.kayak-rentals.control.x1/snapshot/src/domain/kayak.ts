export type KayakType = 'single' | 'double';

export interface Kayak {
  readonly id: string;
  readonly name: string;
  readonly type: KayakType;
}

export const DEPOSIT_CENTS: Readonly<Record<KayakType, number>> = { single: 3000, double: 5000 };
