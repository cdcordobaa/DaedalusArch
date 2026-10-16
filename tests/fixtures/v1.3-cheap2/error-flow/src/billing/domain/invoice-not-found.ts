import { NotFoundException } from '@nestjs/common';

/** A project subclass of a framework HTTP exception. */
export class InvoiceNotFound extends NotFoundException {}
