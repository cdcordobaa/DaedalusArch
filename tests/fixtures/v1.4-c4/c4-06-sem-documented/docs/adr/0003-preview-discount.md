# ADR-0003: The confirmation e-mail shows a preview discount

Status: Accepted
Date: 2026-05-20

## Decision
OrderNotificationService computes the preview discount shown in the confirmation e-mail on purpose.
The e-mail shows an estimate; the binding discount is computed in the ordering domain at invoicing.
This is an accepted exception to keeping pricing rules in the domain layer.
