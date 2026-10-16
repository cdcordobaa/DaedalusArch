export class InvoiceId {
  private series = '';

  constructor(readonly value: string) {
    if (value.length === 0) throw new Error('InvoiceId is empty');
  }

  setSeries(series: string): void {
    this.series = series;
  }

  qualified(): string {
    return this.series === '' ? this.value : `${this.series}-${this.value}`;
  }
}
