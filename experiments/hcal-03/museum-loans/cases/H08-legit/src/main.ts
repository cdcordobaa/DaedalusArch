import { ApproveLoanUseCase } from './application/approve-loan.use-case';
import { GetLoanUseCase } from './application/get-loan.use-case';
import { RequestLoanUseCase } from './application/request-loan.use-case';
import { LoanController } from './adapters/in/http/loan.controller';
import { SystemClock } from './adapters/out/clock/system.clock';
import { StubCourierGateway } from './adapters/out/courier/stub-courier.gateway';
import { FetchHttpClient } from './adapters/out/insurance/fetch-http-client';
import { RestInsuranceGateway } from './adapters/out/insurance/rest-insurance.gateway';
import { LogNotifier } from './adapters/out/notification/log.notifier';
import { InMemoryConditionReportRepository } from './adapters/out/persistence/in-memory-condition-report.repository';
import { InMemoryLoanRepository } from './adapters/out/persistence/in-memory-loan.repository';

export function compose(): LoanController {
  const loans = new InMemoryLoanRepository();
  const reports = new InMemoryConditionReportRepository();
  const insurance = new RestInsuranceGateway('https://insurer.example/api', new FetchHttpClient());
  const courier = new StubCourierGateway();
  const notifier = new LogNotifier();
  const clock = new SystemClock();
  const registry = new Map<string, unknown>([
    ['loans', loans],
    ['notifier', notifier],
  ]);

  const requestLoan = new RequestLoanUseCase(
    registry.get('loans') as InMemoryLoanRepository,
    reports,
    clock,
    registry.get('notifier') as LogNotifier,
  );
  const approveLoan = new ApproveLoanUseCase(loans, insurance, courier, notifier);
  const getLoan = new GetLoanUseCase(loans);
  return new LoanController(requestLoan, approveLoan, getLoan);
}
