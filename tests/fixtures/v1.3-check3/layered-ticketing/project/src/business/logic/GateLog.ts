import { ScanStore } from '../../persistence/ScanStore';

export class GateLog {
  constructor(private readonly scans: ScanStore) {}

  async scanned(code: string, gate: string): Promise<void> {
    await this.scans.save({ id: `${gate}:${code}`, code, gate, at: new Date() });
  }

  async busiestGate(): Promise<string | undefined> {
    const counts = new Map<string, number>();
    for (const row of await this.scans.all()) counts.set(row.gate, (counts.get(row.gate) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  }
}
