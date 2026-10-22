# Invoicing service

Strict layering: presentation calls business, and business calls persistence.
One exception: report controllers (src/presentation/*-report.controller.ts) are allowed to read repositories directly, for read-only reports.
