import { MarketService } from "../application/market-service.js";
import { TILLWAVE_POLL_INTERVAL_MS, TillWaveSync } from "../application/tillwave-sync.js";
import { createApp } from "./http-app.js";
import { createMemoryRepositories } from "./memory-repositories.js";
import { HttpTillWaveGateway } from "./tillwave-client.js";

const port = Number(process.env.PORT ?? 3000);
const service = new MarketService(createMemoryRepositories());
const app = createApp(service);

const tillWaveUrl = process.env.TILLWAVE_API_URL;
if (tillWaveUrl) {
  const sync = new TillWaveSync(new HttpTillWaveGateway(tillWaveUrl, process.env.TILLWAVE_API_KEY), service);
  let running = false;
  const tick = (): void => {
    if (running) return;
    running = true;
    sync
      .poll()
      .catch((err: unknown) => console.error("TillWave poll failed", err))
      .finally(() => {
        running = false;
      });
  };
  setInterval(tick, TILLWAVE_POLL_INTERVAL_MS);
  tick();
}

app.listen(port, () => {
  console.log(`Market service listening on ${port}`);
});
