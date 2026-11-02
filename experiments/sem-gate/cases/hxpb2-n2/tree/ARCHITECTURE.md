# Architecture

This codebase follows the Hexagonal (ports and adapters) architecture. Every change keeps these rules.

1. **Ports carry only domain types.** The interfaces between the application core and the outside world are written
   in the application's own types. No type, field name or error from a vendor or an infrastructure library appears in a
   port.
2. **Vendor and infrastructure code stays in adapters.** Only adapters, and the composition root that wires them,
   import vendor SDKs or infrastructure libraries. The domain and the application core never depend on them.

## Bureau glossary: job steps

The bureau's service charter distinguishes six steps of a translation job, and each one carries a bureau rule.

- **open**: the job is offered and no translator has it; after two working days the bureau raises the fee by 10 %.
- **taken**: a translator has accepted the job but not started; the client may still cancel free of charge.
- **writing**: the translation is in progress; a cancellation now costs half the price.
- **review**: a second linguist checks the text; the bureau's quality rules require it for every order.
- **handed**: the text is with the bureau; the order can be invoiced.
- **contested**: the bureau or the translator has raised a complaint; the account manager calls the client within a
  day and no invoice is sent.
