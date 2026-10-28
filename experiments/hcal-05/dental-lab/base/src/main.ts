import { CaseController } from './adapters/in/http/case.controller';
import { ConsoleNotifier } from './adapters/out/notification/console-notifier';
import { InMemoryCaseRepository } from './adapters/out/persistence/in-memory-case.repository';
import { ScanFabScanAnalyzer } from './adapters/out/scan/scanfab-scan-analyzer';
import { SubmitCaseUseCase } from './application/submit-case.use-case';

const useCase = new SubmitCaseUseCase(
  new InMemoryCaseRepository(),
  new ScanFabScanAnalyzer('demo-key'),
  new ConsoleNotifier(),
);
export const caseController = new CaseController(useCase);
