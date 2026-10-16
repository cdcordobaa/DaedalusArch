import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { startExpress } from './shop/presentation/express-app';

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  startExpress();
}
