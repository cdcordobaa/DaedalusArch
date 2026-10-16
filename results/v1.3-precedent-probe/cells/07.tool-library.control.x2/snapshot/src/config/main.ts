import express from 'express';
import { toolRoutes } from '../adapters/inbound/http-routes';
import { ConsoleMailer } from '../adapters/outbound/console-mailer';
import { InMemoryLoanRepository } from '../adapters/outbound/in-memory-loan-repository';
import { InMemoryMemberRepository } from '../adapters/outbound/in-memory-member-repository';
import { InMemoryToolRepository } from '../adapters/outbound/in-memory-tool-repository';
import { InMemoryWaitingListRepository } from '../adapters/outbound/in-memory-waiting-list-repository';
import { JoinWaitingList } from '../application/join-waiting-list';
import { LendTool } from '../application/lend-tool';
import { RegisterTool } from '../application/register-tool';
import { ReturnTool } from '../application/return-tool';

export function buildApp(): express.Express {
  const tools = new InMemoryToolRepository();
  const members = new InMemoryMemberRepository();
  const loans = new InMemoryLoanRepository();
  const mailer = new ConsoleMailer();
  const waitingList = new InMemoryWaitingListRepository();
  const app = express();
  app.use(express.json());
  app.use(
    toolRoutes({
      registerTool: new RegisterTool(tools),
      lendTool: new LendTool(tools, members, loans, mailer),
      returnTool: new ReturnTool(tools, loans, waitingList, members, mailer),
      joinWaitingList: new JoinWaitingList(tools, members, waitingList),
    }),
  );
  return app;
}

if (require.main === module) {
  buildApp().listen(3000, () => console.log('tool library on :3000'));
}
