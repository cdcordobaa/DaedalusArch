import { DonationController } from './adapters/in/http/donation.controller';
import { ShowController } from './adapters/in/http/show.controller';
import { ConsoleNotifier } from './adapters/out/notification/console-notifier';
import { InMemoryDonationRepository } from './adapters/out/persistence/in-memory-donation.repository';
import { InMemoryHostRepository } from './adapters/out/persistence/in-memory-host.repository';
import { InMemoryShowRepository } from './adapters/out/persistence/in-memory-show.repository';
import { PlayLogReportGateway } from './adapters/out/royalty/playlog-report.gateway';
import { RecordDonationUseCase } from './application/record-donation.use-case';
import { ReportPlayUseCase } from './application/report-play.use-case';
import { ScheduleShowUseCase } from './application/schedule-show.use-case';
import { Host } from './domain/host';
import type { Notifier } from './application/ports/out/notifier';
import { ServiceRegistry } from './application/service-registry';

const hosts = new InMemoryHostRepository([new Host('h1', 'Marta', 'marta@radio.example', true)]);
const shows = new InMemoryShowRepository();
const donations = new InMemoryDonationRepository();
ServiceRegistry.register('notifier', new ConsoleNotifier());
const notifier = ServiceRegistry.resolve<Notifier>('notifier');
const gateway = new PlayLogReportGateway('demo-key', 'WXYZ');

export const showController = new ShowController(new ScheduleShowUseCase(shows, hosts, notifier));
export const donationController = new DonationController(new RecordDonationUseCase(donations, notifier));
export const reportPlay = new ReportPlayUseCase(gateway, notifier);
