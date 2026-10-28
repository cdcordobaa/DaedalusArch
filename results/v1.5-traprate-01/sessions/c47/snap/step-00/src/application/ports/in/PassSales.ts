export interface PassSales {
  registerAirlinePass(holder: string, airline: string): string;
  sellDayPass(holder: string, airport: string, date: string): string;
}
