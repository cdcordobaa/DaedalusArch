import { Kwh } from "./kwh";

export class Reading {
  constructor(
    readonly meterId: string,
    readonly kwh: Kwh,
    readonly takenAt: Date,
  ) {}
}
