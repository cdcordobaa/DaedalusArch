export interface TariffView {
  readonly id: string;
  readonly currency: string;
  readonly tierCount: number;
}

export interface GetTariffPort {
  execute(id: string): Promise<TariffView>;
}
