import { ErrorRequestHandler } from 'express';
import { NotFoundError, PaymentDeclinedError, ValidationError } from '../../../application/errors';
import { DomainError } from '../../../domain/domain-error';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof DomainError) {
    res.status(422).json({ code: error.code, message: error.message });
  } else if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof PaymentDeclinedError) {
    res.status(error.status).json({ message: error.message });
  } else {
    res.status(500).json({ message: 'Internal error' });
  }
};
