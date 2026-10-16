import express from 'express';
import { Container } from 'typedi';
import { useContainer } from 'typeorm';
import { Container as TypeormContainer } from 'typeorm-typedi-extensions';
import { errorHandler } from '../adapters/inbound/http/error-handler';
import { httpRouter } from '../adapters/inbound/http/router';
import { MailNotificationsAdapter } from '../adapters/outbound/notifications/mail-notifications.adapter';
import { CardPaymentsGateway } from '../adapters/outbound/payments/card-payments.gateway';
import { TranslationMemoryAdapter } from '../adapters/outbound/memory/translation-memory.adapter';
import { SystemClock } from '../adapters/outbound/system-clock';
import { UuidGenerator } from '../adapters/outbound/uuid-generator';
import { CLOCK } from '../application/ports/clock.port';
import { IDS } from '../application/ports/id-generator.port';
import { NOTIFICATIONS } from '../application/ports/notifications.port';
import { PAYMENTS } from '../application/ports/payments.port';
import { TRANSLATION_MEMORY } from '../application/ports/translation-memory.port';
import { createDataSource } from './data-source';
import { externalClients } from './external-clients';

/** Composition root: binds every port to its adapter, opens the database and starts HTTP. */
async function main(): Promise<void> {
  const clients = externalClients(process.env);
  useContainer(TypeormContainer);
  await createDataSource(process.env['DATABASE_URL']).initialize();
  Container.set(CLOCK, new SystemClock());
  Container.set(IDS, new UuidGenerator(clients.randomUUID));
  Container.set(PAYMENTS, new CardPaymentsGateway(clients.psp));
  Container.set(NOTIFICATIONS, new MailNotificationsAdapter(clients.mailer, process.env['PORTAL_URL'] ?? ''));
  Container.set(TRANSLATION_MEMORY, new TranslationMemoryAdapter(clients.tm));
  express().use(express.json()).use('/api', httpRouter()).use(errorHandler).listen(Number(process.env['PORT'] ?? 8080));
}

void main();
