export class Lane {
  constructor(readonly code: string, readonly from: string, readonly to: string) {}

  serves(from: string, to: string): boolean {
    return this.from === from && this.to === to;
  }
}
