import { EstimateBillUseCase } from "./application/estimate-bill.use-case";
import { SubmitReadingUseCase } from "./application/submit-reading.use-case";
import { BillController } from "./adapters/in/http/bill.controller";
import { ReadingController } from "./adapters/in/http/reading.controller";
import { ReadingMessageConsumer } from "./adapters/in/consumer/reading-message.consumer";
import { GridOperatorClient } from "./adapters/out/gridoperator/grid-operator.client";
import { EmailNotifier } from "./adapters/out/notifier/email.notifier";
import { InMemoryMeterRepository } from "./adapters/out/persistence/in-memory-meter.repository";
import { InMemoryTariffRepository } from "./adapters/out/persistence/in-memory-tariff.repository";
import { Meter } from "./domain/meter";
import { Tariff } from "./domain/tariff";

const meters = new InMemoryMeterRepository([new Meter("m-1", "flat")]);
const tariffs = new InMemoryTariffRepository([
  new Tariff("flat", "EUR", [
    { upToKwh: 300, centsPerKwh: 20 },
    { upToKwh: null, centsPerKwh: 28 },
  ]),
]);
const grid = new GridOperatorClient();
const notifier = new EmailNotifier();

const submitReading = new SubmitReadingUseCase(meters, grid);
const estimateBill = new EstimateBillUseCase(meters, tariffs, notifier);

export const readingController = new ReadingController(submitReading);
export const billController = new BillController(estimateBill, tariffs);
export const readingConsumer = new ReadingMessageConsumer(submitReading);
