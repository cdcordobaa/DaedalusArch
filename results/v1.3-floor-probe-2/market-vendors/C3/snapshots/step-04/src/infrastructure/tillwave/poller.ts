import { CardSales } from '../../application/use-cases/card-sales';
import { TillWaveApi } from '../../application/ports';

export const POLL_EVERY_MS = 15 * 60 * 1000;

export function startTillWavePoller(sales: CardSales, api: TillWaveApi, everyMs = POLL_EVERY_MS): () => void {
  let cursor: string | undefined;
  let running = false;
  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const r = await sales.pollTillWave(api, cursor);
      cursor = r.cursor;
      if (r.rejected.length > 0) console.warn('TillWave sales rejected', r.rejected);
    } catch (e) {
      console.error('TillWave poll failed', e);
    } finally {
      running = false;
    }
  };
  const h = setInterval(() => { void tick(); }, everyMs);
  void tick();
  return () => clearInterval(h);
}
