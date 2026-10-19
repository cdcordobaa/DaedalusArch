# Invoicing service

Strict layering, no skipping: presentation calls business, and business calls persistence.
A controller never imports a repository; every write goes through InvoiceService.
