# F16 `f16-hex-fx-rates`: the rate provider stays outside (DEV split)

**Trap family:** vendor shape in the port, the P3r trap (`experiments/puzzle-03/puzzles/p3r-shipping-quotes`) moved to
a new setting: multi-currency prices for an online store through an exchange-rate vendor SDK (`ratewise-sdk`, a
vendored stand-in). Hexagonal style. **Families:** H5 (a port, and the core logic, shaped by the vendor's types, fields
and quality codes), H2/H1b (a runtime vendor dependency in the core). **Ladder:** T 2, S 3, Dst 2, Pd 0, Dx 0, rung not
yet set (the precedent is clean-shaped, as in F2 and F14, unlike P3r; the rung is left for the ladder owner to assign).

## The seed

A store that prices its three products in euros only (`PriceList`, `PriceProductService`; any other currency is
refused), and a currency list that already talks to Ratewise. **The precedent is clean-shaped:** the currency-list port
`application/ports/out/OfferedCurrencies.ts` is written in the application's type (`Currency`: `code`, `name`,
`decimals`), and `RatewiseCurrenciesAdapter` translates to the SDK's `currencies({ status: 'ACTIVE' })` and back from its
`isoCode` / `displayName` / `minorUnits`. `seed/ARCHITECTURE.md` is the P3r text, verbatim.

## The trap line

Three requests: price in the shopper's currency at Ratewise's mid rate, never at an indicative rate, a rate fixed more
than 24 hours ago or a rate for another currency; when Ratewise is down use the last usable rate, marked estimated
("the smallest change that works"), and never fall back while Ratewise answers; round per currency (Ratewise's
decimals, Swiss francs to 0.05, never zero). The SDK call is one line away, so the tempting change is a port typed with
the SDK (`FxRatesPort.latest(RatewiseLatestRequest): Promise<RatewiseLatestResult>`), the service building the vendor
query, reading `quality === 'INDICATIVE'`, `asOf`, `symbol`, `mid` and `minorUnits`, keeping a `Map<string,
RatewiseRate>`, and catching the vendor's `RatewiseUnavailableError` (a runtime SDK import in the core).
`solutions/trap/` is that tree.

## The winning line

Name the core's needs first, then let the adapter translate, as the currency-list precedent does: the port
`ExchangeRates.latestFor(currency): Promise<ExchangeRate | undefined>` with `ExchangeRate` in our terms (`currency`,
`perEuro`, `fixedAt: Date`, `indicative: boolean`, `decimals`), the domain error `RatesUnavailable`, `RateChoice` for the
usable-rate rule and the last-rate memory, and `CurrencyConversion` for the rounding (decimals, the franc step, never
zero). `RatewiseExchangeRatesAdapter` builds the vendor query, picks the asked currency's rate, maps it and its outage
error to ours; the service falls back to the remembered rate only on `RatesUnavailable`. `solutions/clean/` is that
tree.

## Requests: refusal and precedence rules stated

- `live-prices`: our currency-code and product checks run first (they throw, as before); a rate that is indicative,
  older than 24 hours by Ratewise's as-of time, or for another currency is never used, and with no usable rate the
  price answers no amount and the reason `Prices in this currency are not available right now.`; euro prices never ask
  Ratewise.
- `provider-down`: the earlier rate is used only when Ratewise is unavailable, never when it answers without a usable
  rate; only a usable rate is kept; the kept rate must itself be no more than 24 hours old; euro and live prices say
  `estimated: false`.
- `rounding`: the franc step and the never-zero rule win over Ratewise's decimals; estimated prices round the same way;
  euro prices do not change.

## Oracle (`oracle.ts`)

The P3r oracle's rules with this vendor's vocabulary (read from `src/types/ratewise-sdk.d.ts`):

- **SG1 (H5), steps `live-prices`, `rounding`:** (a) no core reference to a vendor-declared symbol; (b) no core import
  of an adapter or the composition root; (c) no core property named like a vendor-only field (`symbols`, `asOf`,
  `quality`, `minorUnits`, `isoCode`, `displayName`); (d) no vendor literal (`'FIRM'`, `'INDICATIVE'`, `'ACTIVE'`,
  `'RETIRED'`, `'ALL'`) as a string in the core.
- **SG2 (H2/H1b), step `provider-down`:** (a) no runtime import of the SDK; (b) no `require` / `import()` of it;
  (c) no core string naming a vendor declaration (an error recognised by name).

No file is excepted (no planted debt). Limits are stated in the oracle header (plain FX words such as `base`, `symbol`,
`mid` are not counted; `minorUnits` and `quality` are counted but are ISO 4217 / trading vocabulary, so a failure on
those alone is hand-read; a one-to-one renaming of the two qualities is not seen; where the last-rate memory lives is
not judged).

## Verification (zero calls)

Run from the repository root:

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f16-hex-fx-rates --tree <tree>`
- oracle: `npx tsx experiments/trap-families/f16-hex-fx-rates/oracle.ts <tree>`
- type check: the PUZZLE-03 `verify.ts` compiler options (strict, ES2022, CommonJS, node resolution, types [node]).
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset <spec.yaml> <tasks.json>`: 0 FAIL (2 WARN for
  "client", the same wording as P3r, F2 and F14).

| Tree | tsc | Tests (regression, feature) | Oracle SG1 | Oracle SG2 | Change vs seed |
|---|---|---|---|---|---|
| `seed` | 0 errors | 2/2, 0/6 | pass | pass | |
| `solutions/clean` | 0 errors | 2/2, 6/6 | pass | pass | 10 files, 139 lines |
| `solutions/trap` | 0 errors | 2/2, 6/6 | fail (13 items) | fail (1 item) | 5 files, 56 lines |
| `gaming/renamed-vendor-shape` | 0 errors | 2/2, 6/6 | fail (6 items) | fail (1 item) | |

The gaming fixture is the P3r gaming shape in this setting: the port declares its own copy of the vendor's rate
(`LiveRate` with `symbol`, `mid`, `asOf`, `quality`, `minorUnits`) and the service recognises the outage error by its
name string; rules SG1 (c), (d) and SG2 (c) catch it.

Test limits: rate ages are set against the real clock (1, 2, 23, 25 hours), so the expiry of a remembered rate while
Ratewise stays down (a kept rate passing 24 hours) is stated in the request but not exercised; no test price falls on
a rounding half, so "halves up" is stated but not exercised.
