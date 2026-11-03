# Architecture

This codebase follows the Hexagonal (ports and adapters) architecture. Every change keeps these rules.

1. **Ports carry only domain types.** The interfaces between the application core and the outside world are written
   in the application's own types. No type, field name or error from a vendor or an infrastructure library appears in a
   port.
2. **Vendor and infrastructure code stays in adapters.** Only adapters, and the composition root that wires them,
   import vendor SDKs or infrastructure libraries. The domain and the application core never depend on them.

## Bureau glossary: order stages

The bureau runs its order book on six stages, the words its project managers use, and each carries a rule.

- **posted**: the job is out to translators; the client may still change the brief.
- **claimed**: a translator has taken the job; the brief is frozen and the bureau sends the glossary pack.
- **drafting**: the translator is writing; the client may ask a question once through the bureau.
- **proofreading**: a second linguist checks the text; the project manager signs it off.
- **delivered**: the file is with the bureau; the invoice goes out the same day.
- **disputed**: the client or the translator has raised a dispute; the project manager calls both within a day.
