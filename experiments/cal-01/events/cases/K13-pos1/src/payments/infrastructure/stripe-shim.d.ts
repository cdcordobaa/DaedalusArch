declare module "stripe" {
  export interface Charge {
    id: string;
    amount: number;
    paid: boolean;
  }
}
