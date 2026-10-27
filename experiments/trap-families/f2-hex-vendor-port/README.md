# F2 `f2-hex-vendor-port`: the payment provider stays outside (DEV split)

**Trap family:** vendor shape in the port, the P3r trap (`experiments/puzzle-03/puzzles/p3r-shipping-quotes`) moved to
a new setting: card payments at an online checkout through a payment provider SDK (`paystream-sdk`, a vendored
stand-in). Hexagonal style. **Families:** H5 (a port, and the core logic, shaped by the vendor's types, fields and
codes), H2/H1b (a runtime vendor dependency in the core). **Ladder:** T 2, S 3, Dst 2, Pd 0, Dx 0, rung not yet set
(the precedent differs from P3r, see below; the rung is left for the ladder owner to assign).

## The seed

A checkout that places every order on invoice (`Invoicing`, our own path) and a refund use case that already talks to
Paystream. **The precedent is clean-shaped**, unlike P3r's: the refund port `application/ports/out/Refunds.ts` is
written in the application's types (`Money`, `RefundReceipt`), and `PaystreamRefundsAdapter` translates to the SDK's
`chargeId` / `amountMinor` and back from its `refundId` / `state`. `seed/ARCHITECTURE.md` is the P3r text, verbatim.

## The trap line

Three requests: charge the card (total plus a 1.5% surcharge, Paystream's charge id as the reference); fall back to
the invoice when Paystream is down ("the smallest change that works"); tell the customer why a card was declined. The
SDK's call is one line away, so the tempting change is a port typed with the SDK
(`PaymentsPort.charge(PaystreamChargeRequest): Promise<PaystreamCharge>`), the service building the vendor request in
minor units, reading `state === 'DECLINED'` and the vendor's `declineCode` values, and catching the vendor's
`PaystreamUnavailableError` (a runtime SDK import in the core). `solutions/trap/` is that tree.

## The winning line

Name the core's needs first, then let the adapter translate, as the refund precedent does: the port
`CardPayments.charge(order, amount, cardToken): Promise<CardCharge>` with `CardCharge` accepted (with a reference) or
refused (with our own `DeclineReason`: `not-enough-funds`, `card-expired`, `other`), the domain error
`PaymentsUnavailable`, and `CardPricing` for the surcharge. `PaystreamCardPaymentsAdapter` builds the vendor request,
maps the vendor's decline codes to our reasons and its outage error to ours; the service picks the customer message
and falls back to the invoice on `PaymentsUnavailable`. `solutions/clean/` is that tree.

## Oracle (`oracle.ts`)

The P3r oracle's rules with this vendor's vocabulary (read from `src/types/paystream-sdk.d.ts`):

- **SG1 (H5), steps `card-payments`, `declines`:** (a) no core reference to a vendor-declared symbol; (b) no core
  import of an adapter or the composition root; (c) no core property named like a vendor-only field (`amountMinor`,
  `chargeId`, `declineCode`, `captureMethod`, `merchantReference`, `refundId`, `holderName`); (d) no vendor literal
  (`'DECLINED'`, `'insufficient_funds'`, `'automatic'`, ...) as a string in the core.
- **SG2 (H2/H1b), step `provider-down`:** (a) no runtime import of the SDK; (b) no `require` / `import()` of it;
  (c) no core string naming a vendor declaration (an error recognised by name).

No file is excepted (no planted debt). Limits are stated in the oracle header.

## Verification (zero calls)

Run from the repository root:

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f2-hex-vendor-port --tree <tree>`
- oracle: `npx tsx experiments/trap-families/f2-hex-vendor-port/oracle.ts <tree>`
- type check: the PUZZLE-03 `verify.ts` compiler options (strict, ES2022, CommonJS, node resolution, types [node]).

| Tree | tsc | Tests (regression, feature) | Oracle SG1 | Oracle SG2 |
|---|---|---|---|---|
| `seed` | 0 errors | 2/2, 0/4 | pass | pass |
| `solutions/clean` | 0 errors | 2/2, 4/4 | pass | pass |
| `solutions/trap` | 0 errors | 2/2, 4/4 | fail | fail |

No gaming fixture is built yet; the P3r gaming shape (a renamed copy of the vendor's charge shape, the outage error
recognised by name) is covered by rules SG1 (c) and SG2 (c), not yet exercised on a tree.
