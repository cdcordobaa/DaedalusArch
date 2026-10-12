/** Inbound port: what inbound adapters call. */
export interface PlaceOrderPort {
  execute(id: string, total: number): void;
}
