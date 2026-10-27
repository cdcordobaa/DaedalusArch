declare module "express" {
  export interface Request {
    body: { id: string; serial: string; name: string; dailyRateCents: number };
  }
}
