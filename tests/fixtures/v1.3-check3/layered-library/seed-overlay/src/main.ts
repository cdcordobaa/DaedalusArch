import { LendingService } from './business/services/LendingService';
import { LoanHistoryService } from './business/services/LoanHistoryService';
import { BookGateway } from './persistence/BookGateway';
import { LoanGateway } from './persistence/LoanGateway';
import { MemberGateway } from './persistence/MemberGateway';
import { PrismaService } from './persistence/PrismaService';
import { LoanController } from './presentation/http/LoanController';
import { loanRoutes } from './presentation/routes';

export async function bootstrap(): Promise<ReturnType<typeof loanRoutes>> {
  const db = new PrismaService();
  await db.connect();
  const lending = new LendingService(new BookGateway(db), new MemberGateway(db), new LoanGateway(db));
  return loanRoutes(new LoanController(lending, new LoanHistoryService(db)));
}
