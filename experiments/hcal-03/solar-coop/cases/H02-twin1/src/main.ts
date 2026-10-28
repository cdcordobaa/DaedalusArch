import { GetMemberStatementUseCase } from './application/get-member-statement.use-case';
import { IssueMonthlyCreditsUseCase } from './application/issue-monthly-credits.use-case';
import { SubscribeSharesUseCase } from './application/subscribe-shares.use-case';
import { MemberController } from './adapters/in/http/member.controller';
import { InverterApiClient } from './adapters/out/inverter/inverter-api.client';
import { InverterApiGateway } from './adapters/out/inverter/inverter-api.gateway';
import { EmailNotifier } from './adapters/out/notification/email.notifier';
import { PaymentProviderClient } from './adapters/out/payment/payment-provider.client';
import { PaymentProviderGateway } from './adapters/out/payment/payment-provider.gateway';
import { InMemoryCreditRepository } from './adapters/out/persistence/in-memory-credit.repository';
import { InMemoryMemberRepository } from './adapters/out/persistence/in-memory-member.repository';
import { InMemoryShareSubscriptionRepository } from './adapters/out/persistence/in-memory-share-subscription.repository';
import { MemoryDb } from './adapters/out/persistence/memory-db';
import { SystemClock } from './adapters/out/time/system-clock';

export function buildApp(): MemberController {
  const db = new MemoryDb();
  const members = new InMemoryMemberRepository(db);
  const subscriptions = new InMemoryShareSubscriptionRepository(db);
  const credits = new InMemoryCreditRepository(db);
  const monitoring = new InverterApiGateway(new InverterApiClient('https://inverter.example'));
  const payouts = new PaymentProviderGateway(new PaymentProviderClient());
  const notifier = new EmailNotifier();
  const clock = new SystemClock();

  const subscribe = new SubscribeSharesUseCase(members, subscriptions, notifier, clock);
  const issue = new IssueMonthlyCreditsUseCase(subscriptions, monitoring, credits, payouts, notifier, 'CoopPay');
  const statement = new GetMemberStatementUseCase(members, subscriptions, credits);
  return new MemberController(subscribe, issue, statement);
}

export const controller = buildApp();
