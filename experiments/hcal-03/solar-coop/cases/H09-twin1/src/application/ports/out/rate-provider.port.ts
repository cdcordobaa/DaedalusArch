export interface RateProvider {
  centsPerKwh(): Promise<number>;
}
