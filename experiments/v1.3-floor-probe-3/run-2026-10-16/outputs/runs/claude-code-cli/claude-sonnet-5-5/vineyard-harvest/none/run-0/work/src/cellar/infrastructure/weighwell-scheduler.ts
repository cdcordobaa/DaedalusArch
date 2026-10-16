import type { WeighWellSync } from "../application/weighwell-sync.js";

export const WEIGHWELL_POLL_MS = 5 * 60 * 1000;

export function startWeighWellPolling(sync: WeighWellSync, intervalMs: number = WEIGHWELL_POLL_MS): NodeJS.Timeout {
  let running = false;
  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      await sync.poll();
    } catch (e) {
      console.error("WeighWell poll failed", e);
    } finally {
      running = false;
    }
  };
  void tick();
  return setInterval(() => void tick(), intervalMs);
}
