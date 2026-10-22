# Invoicing service

Strict layering: presentation calls business, and business calls persistence.
One exception: src/presentation/admin-report.controller.ts is allowed to read repositories directly; invoice-report.controller.ts and every other controller go through a service.
