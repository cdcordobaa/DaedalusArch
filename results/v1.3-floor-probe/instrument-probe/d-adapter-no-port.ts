export class AquaTickClient {
  async latest(meterId: string): Promise<number> { const r = await fetch(`https://aquatick.example/${meterId}`); return Number(await r.text()); }
}
