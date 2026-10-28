export interface InverterMonitoring {
  monthlyProductionKwh(period: string): Promise<number>;
}
