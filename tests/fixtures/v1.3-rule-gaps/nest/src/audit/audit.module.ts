import { Module } from '@nestjs/common';
import { AuditSink, ConsoleAuditSink } from './audit-sink';
import { AuditService } from './audit.service';

@Module({ providers: [AuditService, { provide: AuditSink, useClass: ConsoleAuditSink }] })
export class AuditModule {}
