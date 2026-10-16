import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtworksModule } from './artworks/artworks.module';
import { ExhibitionsModule } from './exhibitions/exhibitions.module';
import { SystemClock } from './infrastructure/system-clock';
import { LendersModule } from './lenders/lenders.module';
import { LoansModule } from './loans/loans.module';
import { CLOCK } from './shared/domain/clock';

@Module({
  imports: [
    TypeOrmModule.forRoot({ type: 'postgres', url: process.env['DATABASE_URL'], synchronize: false }),
    ExhibitionsModule,
    LoansModule,
    ArtworksModule,
    LendersModule,
  ],
  providers: [{ provide: CLOCK, useClass: SystemClock }],
  exports: [CLOCK],
})
export class AppModule {}
