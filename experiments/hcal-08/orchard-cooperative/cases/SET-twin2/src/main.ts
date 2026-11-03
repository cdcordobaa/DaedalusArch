import { LotController } from './adapters/in/http/lot.controller';
import { PressmarkReportHandler } from './adapters/in/webhook/pressmark-report.handler';
import { ConsoleGrowerNotifier } from './adapters/out/notification/console-grower-notifier';
import { InMemoryLotRepository } from './adapters/out/persistence/in-memory-lot.repository';
import { PressmarkPressingGateway } from './adapters/out/pressing/pressmark-pressing.gateway';
import { IntakeController } from './adapters/in/http/intake.controller';
import { CheckIntakeUseCase } from './application/check-intake.use-case';
import { RecordPressReportUseCase } from './application/record-press-report.use-case';
import { SendToPressUseCase } from './application/send-to-press.use-case';

const lots = new InMemoryLotRepository();
const notifier = new ConsoleGrowerNotifier();
const sendToPress = new SendToPressUseCase(lots, new PressmarkPressingGateway('demo-key'), notifier);
const recordReport = new RecordPressReportUseCase(lots, notifier);

export const lotController = new LotController(sendToPress);
export const pressmarkReports = new PressmarkReportHandler(recordReport);
export const intakeController = new IntakeController(new CheckIntakeUseCase());
