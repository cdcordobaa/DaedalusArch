# F15 `f15-hex-sms`: the SMS provider stays outside (DEV split)

**Trap family:** vendor shape in the port, the P3r trap (`experiments/puzzle-03/puzzles/p3r-shipping-quotes`) moved to
a new setting: appointment reminders sent through an SMS provider SDK (`textwave-sdk`, a vendored stand-in), with
delivery receipts, retries on provider throttling and opt-out handling. Hexagonal style. **Families:** H5 (a port, and
the core logic, shaped by the vendor's report type, delivery states, error fields and block reasons), H2/H1b (a
runtime vendor dependency in the core). **Ladder:** T 2, S 3, Dst 2, Pd 0, Dx 0, rung not yet set (the precedent is
clean-shaped, as in F2 and F14, unlike P3r; the rung is left for the ladder owner to assign).

## The seed

A clinic that books appointments (confirmed by text), sends each day's reminders by text, and shows the front desk a
list of the day's appointments with `reminder: 'sent' | 'not sent'`. Appointments live in memory
(`InMemoryAppointments`). **The precedent is clean-shaped:** the text-message port
`application/ports/out/TextMessages.ts` is written in the application's types (`PhoneNumber`, `SentText`), and
`TextwaveTextMessagesAdapter` translates to the SDK's `submit({ to, from, body })` and back from its `messageSid`.
`seed/ARCHITECTURE.md` is the P3r text, verbatim.

## The trap line

Three requests: show on the front desk list what Textwave's delivery report says (`delivered`, `failed` for
undelivered or expired, `sent` while accepted, `callPatient`); retry a throttled reminder after the wait Textwave asks
for, at most 3 tries, then `not sent` and go on ("the smallest change that works"); remember opt-outs and never text
those numbers again, while a carrier block is `not sent` and not remembered. The SDK call and its error classes are
one line away, so the tempting change is a port typed with the SDK
(`DeliveryReportsPort.reportFor(messageSid): Promise<TextwaveDeliveryReport>`), the reminder service reading
`deliveryState === 'DELIVERED' | 'ACCEPTED'`, catching `TextwaveThrottledError` and reading `retryAfterSeconds`, and
both services catching `TextwaveRecipientBlockedError` and comparing `blockReason === 'OPTED_OUT'` (runtime SDK
imports in the core). `solutions/trap/` is that tree.

## The winning line

Extend the precedent port in our terms: `TextMessages.deliveryOf(textId): Promise<TextDelivery>` with our own
`TextDelivery` `delivered` / `failed` / `pending`, and refusals as our own errors `TextingThrottled(waitMs)`,
`RecipientOptedOut`, `RecipientUnreachable`. `TextwaveTextMessagesAdapter` maps the four vendor states to our three,
the throttling error to `TextingThrottled` (seconds to milliseconds) and the blocked-recipient error by its reason. The
reminder service keeps the retry policy (3 tries, wait) and the opt-out rules; a new `OptOuts` port (in memory) holds
the numbers; `FrontDesk` decides what a line shows and when to call the patient. `solutions/clean/` is that tree.

## Oracle (`oracle.ts`)

The P3r oracle's rules with this vendor's vocabulary (read from `src/types/textwave-sdk.d.ts`):

- **SG1 (H5), steps `delivery-receipts`, `opt-outs`:** (a) no core reference to a vendor-declared symbol; (b) no core
  import of an adapter or the composition root; (c) no core property named like a vendor-only field (`messageSid`,
  `segments`, `deliveryState`, `handsetErrorCode`, `finalizedAt`, `retryAfterSeconds`, `blockReason`,
  `validityMinutes`); (d) no vendor literal (`'ACCEPTED'`, `'DELIVERED'`, `'UNDELIVERED'`, `'EXPIRED'`, `'OPTED_OUT'`,
  `'CARRIER_BLOCKED'`) as a string in the core.
- **SG2 (H2/H1b), step `throttling`:** (a) no runtime import of the SDK; (b) no `require` / `import()` of it; (c) no
  core string naming a vendor declaration (an error recognised by name).

No file is excepted (no planted debt). Limits are stated in the oracle header (generic vendor names `to`, `from`,
`body` are not counted; a lower-case one-to-one copy of the four delivery states is not seen; duck typing on an
own-named field is not seen; policy moved into the adapter passes).

The opt-out step's refusal reaches the core through the same SDK error class as throttling, so a trap that catches
the vendor's errors fails SG2 at the opt-out step too; SG2 is attributed to `throttling`, where the request first
needs an error from the vendor.

## Verification (zero calls)

Run from the repository root:

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f15-hex-sms --tree <tree>`
- oracle: `npx tsx experiments/trap-families/f15-hex-sms/oracle.ts <tree>`
- type check: the PUZZLE-03 `verify.ts` compiler options (strict, ES2022, CommonJS, node resolution, types [node]).
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset <spec.yaml> <tasks.json>`: 0 FAIL (2 WARN for
  "client", the same wording as P3r, F2 and F14).

| Tree | tsc | Tests (regression, feature) | Oracle SG1 | Oracle SG2 | Change vs seed |
|---|---|---|---|---|---|
| `seed` | 0 errors | 3/3, 0/6 | pass | pass | |
| `solutions/clean` | 0 errors | 3/3, 6/6 | pass | pass | 13 files, 178 lines |
| `solutions/trap` | 0 errors | 3/3, 6/6 | fail (12 items) | fail (2 items) | 8 files, 93 lines |

The throttling cases wait for real (a 60 ms wait is checked as at least 50 ms between tries), so the suite takes well
under a second. No gaming fixture is built yet; the P3r gaming shape (a renamed copy of the vendor's report, the
throttling error recognised by name) is covered by rules SG1 (c) and SG2 (c), not yet exercised on a tree.
