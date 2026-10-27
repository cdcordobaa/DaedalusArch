declare module "gridco-sdk" {
  export interface GridcoResponse {
    meterId: string;
    kwh: number | null;
  }
}
