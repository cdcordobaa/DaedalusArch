# F23 `f23-hex-e-signature`: the signature service stays outside, both ways (DEV split)

**Trap family:** vendor shape in the port, the P3r trap (`experiments/puzzle-03/puzzles/p3r-shipping-quotes`) moved to
a new setting: tenancy agreements signed through an e-signature vendor SDK (`inkwell-sdk`, a vendored stand-in).
Hexagonal style. **New in this variant: the inbound side.** One step tempts the agent to let the vendor's webhook
event types and its callback-handler signature (`InkwellWebhookHandlers`, handed to `client.webhooks.dispatch`) become
the shape the core receives callbacks in, not only to type an outbound port with the SDK. **Families:** H5 outbound
(SG1), H5 inbound (SG2), H2/H1b (SG3). **Ladder:** T 2, S 3, Dst 2, Pd 0, Dx 0, rung not yet set (clean-shaped
precedent, as in F2, F14 and F16; left for the ladder owner).

## The seed

A lettings office drafts tenancy agreements (one landlord, one to four tenants, a monthly rent and a start date;
`Agreement`, `Party`, `AgreementService`, an in-memory store) and shows its Inkwell signing allowance. **The precedent
is clean-shaped:** the allowance port `application/ports/out/AllowanceSource.ts` is written in the application's type
(`SigningAllowance`: `remaining`, `renewsOn: Date`), and `InkwellAllowanceAdapter` translates from the SDK's
`account()` answer (`planCode`, `envelopesRemaining`, `billingCycleEndsAt` with an offset). There is no inbound
precedent: nothing handles a callback yet. `seed/ARCHITECTURE.md` is the P3r text, verbatim.

The SDK typings (`seed/src/types/inkwell-sdk.d.ts`) offer two ways to take a callback: `webhooks.parse(rawBody,
header)` (answers an `InkwellWebhookEvent`) and `webhooks.dispatch(rawBody, header, handlers)`, which calls
`onRecipientDeclined(event)` / `onEnvelopeExpired(event)` / ... on any object that has them. The second is the bait.

## The trap line

Three requests: send an agreement for signature (an envelope with the tenants as signers in order, the landlord
copied, 14 days, the sent time shown in UTC; four refusals in a stated order, the vendor's refused email named, other
failures fail); record Inkwell's callbacks (declined with who and why, expired, signed; 401 on a bad signature; 200 and
no change for unknown or earlier signings, finished agreements and other kinds); send reminders (3 days after sending,
then 3 days apart, at most 2, none after 14 days, only unsigned tenants by Inkwell's report, a busy Inkwell skips one
agreement without counting it). The SDK is one line away, so the tempting change is one `SigningService` that builds
the `InkwellEnvelopeDraft`, reads `envelopeId`, `sentDateTime`, `recipientStatus === 'SIGNED'` and `role === 'SIGNER'`
through an `InkwellPort` typed with the SDK, catches `InkwellError` by `errorCode` (`'INVALID_RECIPIENT'`,
`'RATE_LIMITED'`; a runtime SDK import in the core), and **`implements InkwellWebhookHandlers`**, so the composition
root can hand the service straight to `inkwell.webhooks.dispatch(...)`: the vendor's event types are now the core's
inbound contract. `solutions/trap/` is that tree (7 files, 144 changed lines).

## The winning line

Name the core's needs first, then let the adapters translate, as the allowance precedent does. Outbound:
`SignatureRequests.send(SignatureRequest): Promise<SentSigning>`, `signersYetToSign(ref)`, `remind(ref, emails)`, with
`SignatureRequest` built by `Agreement.signatureRequest()` (subject, text, signers in order, copy, 14 days) and the
domain errors `EmailRefused` and `SignatureServiceBusy`; `InkwellSignatureAdapter` builds the envelope, reads the
recipient statuses and maps the two error codes. Inbound: the core offers
`RecordSigningOutcome.record(signingRef, SigningOutcome)` with `SigningOutcome` in our terms (`declined` with `by` and
`reason`, `expired`, `signed`); the driving adapter `InkwellCallbackController` checks the signature with
`webhooks.parse`, answers 401 on `InkwellSignatureError`, maps the event to an outcome (or to nothing) and answers 200.
The rules sit in the model: `Agreement.ensureSendable`, `markSent`, `record` (only the current signing's first
outcome), `Signing.isReminderDue` (the 3-day rhythm, the cap, the 14-day expiry). `solutions/clean/` is that tree (20
files, 328 changed lines).

## Requests: refusal and precedence rules stated (each one tested)

- `send-for-signature`: refusals in order (unknown, already out for signature, already signed, no allowance left),
  each before any envelope is created; the out-for-signature refusal wins over an empty allowance; Inkwell's refused
  email gives `Inkwell could not accept the email <address>.`; any other Inkwell failure fails the send; a refused or
  failed send changes nothing; a declined or expired agreement may be sent again and nothing of the earlier signing
  carries over.
- `signing-callbacks`: a bad signature answers 401 and changes nothing; unknown signing, earlier sending of a re-sent
  agreement, an agreement no longer out for signature (the first outcome stays), and other kinds of callback answer
  200 and change nothing.
- `reminders`: only agreements out for signature; 72 hours after sending, then 72 hours after the last reminder; at
  most 2 per signing, a re-sent agreement starts with none; none from 14 days after sending, with or without the
  callback; only unsigned tenants, never the landlord, nothing when all have signed; busy skips that agreement without
  counting it and the run goes on; any other failure stops the run; the reminder time is the run's `now`.

## Oracle (`oracle.ts`)

The P3r oracle's rules with this vendor's vocabulary (read from `src/types/inkwell-sdk.d.ts`), the vocabulary split by
which top-level vendor declaration holds a symbol or literal: inbound (`InkwellEventBase`, the four
`Inkwell*Event` types, `InkwellWebhookEvent`, `InkwellWebhookHandlers`, `InkwellWebhooks`, `InkwellSignatureError`)
or outbound (everything else).

- **SG1 (H5 outbound), steps `send-for-signature`, `reminders`:** (a) no core reference to an outbound vendor symbol;
  (b) no core import of an adapter or the composition root; (c) no core property named like an outbound vendor-only
  field (`emailSubject`, `documentBase64`, `routingOrder`, `recipientStatus`, `envelopeStatus`, `sentDateTime`,
  `recipientEmails`, `remindedCount`, `remindedDateTime`, `planCode`, `envelopesRemaining`, `billingCycleEndsAt`,
  `errorCode`); (d) no outbound vendor literal (`'SIGNER'`, `'CC'`, `'SIGNED'`, `'RATE_LIMITED'`, ...) in the core.
- **SG2 (H5 inbound), step `signing-callbacks`:** (a) no core reference to an inbound vendor symbol (a core class that
  `implements InkwellWebhookHandlers` counts); (b) no core method or property named like a vendor callback handler
  (`onRecipientDeclined`, `onRecipientViewed`, `onEnvelopeExpired`, `onEnvelopeCompleted`); (c) no inbound vendor
  literal (`'recipient.declined'`, `'envelope.expired'`, ...) in the core.
- **SG3 (H2/H1b):** (a) no runtime import of the SDK; (b) no `require` / `import()` of it; (c) no core string naming a
  vendor declaration (an error recognised by name).

No file is excepted (no planted debt). Limits are stated in the oracle header: plain e-signature words (`envelopeId`,
`emailAddress`, `role`, `expiresInDays`, ...) and all inbound field names (`eventType`, `occurredAt`, `declineReason`)
are not counted, so a renamed copy that keeps only those and drops the handler names and vendor codes is not seen; a
core that takes the raw body and header as strings is not judged; codes rebuilt from pieces are not seen.

## Verification (zero calls)

Run from the repository root:

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f23-hex-e-signature --tree <tree>`
- oracle: `npx tsx experiments/trap-families/f23-hex-e-signature/oracle.ts <tree>`
- type check: the PUZZLE-03 `verify.ts` compiler options (strict, ES2022, CommonJS, node resolution, types [node]).
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset <spec.yaml> <tasks.json>`: 0 FAIL (2 WARN for
  "client", the same wording as P3r and F16); the seed's `ARCHITECTURE.md` under `--frame --frame-rung L3` with the
  puzzle vocabulary as `--term`s: 0 FAIL, 27 WARN (as P3r).

| Tree | tsc | Tests (regression, feature) | Oracle SG1 | Oracle SG2 | Oracle SG3 | Change vs seed |
|---|---|---|---|---|---|---|
| `seed` | 0 errors | 2/2, 0/9 | pass | pass | pass | |
| `solutions/clean` | 0 errors | 2/2, 9/9 | pass | pass | pass | 20 files, 328 lines |
| `solutions/trap` | 0 errors | 2/2, 9/9 | fail (22 items) | fail (14 items) | fail (1 item) | 7 files, 144 lines |
| `gaming/renamed-vendor-shape` | 0 errors | 2/2, 9/9 | fail (13 items) | fail (6 items) | fail (2 items) | 7 files, 172 lines |

Change sizes are added plus removed lines over `src/`, counted with a line diff (not git).

The gaming fixture is the P3r gaming shape on both sides: the port declares its own copies of the vendor's envelope
draft and envelope, the service declares its own copy of the handler interface (`SigningCallbacks`) and is still handed
to `webhooks.dispatch`, and the vendor's errors are recognised by name and code strings; rules SG1 (c), (d), SG2 (b)
and SG3 (c) catch it.

Test limits: times are fixed and the reminder run is given `now`, so no clock is read; the reminders test re-sends a
declined agreement but does not exercise a reminder on an agreement re-sent after expiry; "any other Inkwell failure
fails the send / stops the run" is exercised with one code each (`SERVICE_UNAVAILABLE`, `UNAUTHORIZED`); a callback
with a body that is not JSON is not tested.
