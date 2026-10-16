import express from "express";
import { errorHandler } from "./shared/http.js";
import { PickingService } from "./picking/application/picking-service.js";
import { PayService } from "./picking/application/pay-service.js";
import { CellarAdapter } from "./picking/acl/cellar-adapter.js";
import { BinOutcomesFacade } from "./cellar/acl/bin-outcomes.js";
import {
  InMemoryApprovedWeekRepository,
  InMemoryPayRulesRepository,
  InMemoryBlockRepository,
  InMemoryPickerRepository,
  InMemoryPickingDayRepository,
} from "./picking/infrastructure/in-memory.js";
import { PickedBinsFacade } from "./picking/acl/published-bins.js";
import { pickingRouter } from "./picking/api/router.js";
import { CellarService } from "./cellar/application/cellar-service.js";
import {
  InMemoryIntakeRepository,
  InMemoryRfidLinkRepository,
  InMemoryUnlinkedWeighingRepository,
  InMemoryVarietyRules,
  InMemoryWeighingRepository,
} from "./cellar/infrastructure/in-memory.js";
import { WeighWellClient } from "./cellar/acl/weighwell.js";
import { WeighWellSync } from "./cellar/application/weighwell-sync.js";
import { startWeighWellPolling } from "./cellar/infrastructure/weighwell-scheduler.js";
import { PickingAdapter } from "./cellar/acl/picking-adapter.js";
import { cellarRouter } from "./cellar/api/router.js";

const days = new InMemoryPickingDayRepository();
const payRules = new InMemoryPayRulesRepository();
const approvals = new InMemoryApprovedWeekRepository();
const picking = new PickingService(
  new InMemoryPickerRepository(),
  new InMemoryBlockRepository(),
  days,
  payRules,
  approvals,
);
const cellar = new CellarService(
  new InMemoryWeighingRepository(),
  new InMemoryIntakeRepository(),
  new PickingAdapter(new PickedBinsFacade(picking)),
  new InMemoryVarietyRules(),
  new InMemoryRfidLinkRepository(),
  new InMemoryUnlinkedWeighingRepository(),
);
const pay = new PayService(picking, days, payRules, approvals, new CellarAdapter(new BinOutcomesFacade(cellar)));

const app = express();
app.use(express.json());
app.use("/picking", pickingRouter(picking, pay));
app.use("/cellar", cellarRouter(cellar));
app.use(errorHandler);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  const weighWellUrl = process.env.WEIGHWELL_URL;
  if (weighWellUrl) {
    startWeighWellPolling(new WeighWellSync(new WeighWellClient(weighWellUrl, process.env.WEIGHWELL_API_KEY), cellar));
  }
  console.log(`vineyard harvest listening on ${port}`);
});
