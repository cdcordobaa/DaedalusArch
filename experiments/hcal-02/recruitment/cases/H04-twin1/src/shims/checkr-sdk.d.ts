declare module "checkr-sdk" {
  export interface CheckrReport {
    id: string;
    status: string;
    adjudication: string | null;
  }
}
