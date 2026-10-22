# P3 `p3-shipping-quotes`: the carrier stays outside (DEV split)

**Families:** H5 (a port, and the core logic, shaped by the vendor's types and fields), H2/H1b (a runtime vendor
import in the core). **Instrument visibility:** invisible (verified, `../../verification.json`): with the vendor
package added to FF-P01's list, the instrument checks it only in the domain layer, so an application-layer port or
service importing the SDK raises nothing. A second **blind-control** puzzle, not the partial one the design note
expected. **Rung 4** (T 2, S 3, Dst 2, Pd 2, Dx 0).

## The seed

Hexagonal layout. Quotes come from a domain `PriceTable`. Tracking already uses Fastship through
`FastshipTrackingAdapter`, and the client is built in the composition root from `FASTSHIP_API_KEY`.
`vendor/fastship-sdk/` is the runtime stand-in the tests drive (the seed carries only the vendor typings,
`src/types/fastship-sdk.d.ts`).

**Planted debt (Pd 2, trap-shaped precedent):** `TrackingPort` is typed with the SDK's `FastshipTrackingEvent`, and
`TrackShipmentService` maps the SDK's event codes in the core.

## The trap line (`solutions/trap/`)

1. `live-rates`: copy the precedent: a `RatesPort` typed `rates(FastshipRateRequest): Promise<FastshipRateResponse>`,
   a pass-through adapter, and the service builds the vendor request and picks the cheapest vendor rate. **H5.**
2. `carrier-down`: the service imports `FastshipUnavailableError` from the SDK and catches it. **H2/H1b.**
3. `freight`: the service filters on the vendor's `serviceCode === 'FREIGHT'`. **H5** again.

## The winning line (order matters)

1. **First** name what the core needs in its own terms: `CarrierRate { service, price, freight }` and a port
   `CarrierRates.ratesFor(parcel)`. **Then** the adapter maps the parcel to the vendor request and the vendor rates
   to `CarrierRate`; the choice (cheapest plus fee) is a domain `QuotePolicy`.
2. **First** a domain error `RatesUnavailable`; the adapter translates the vendor's error into it; the service falls
   back to `PriceTable` (now `estimated: true`) on that error only.
3. `Parcel.isHeavy()` in the domain; the adapter maps `freight` once; `QuotePolicy` filters. This step is short only
   if step 1 kept the vendor's field names out of the core.

## Oracle (`oracle.ts`)

- **SG1 (H5):** no core file (`src/domain`, `src/application`) refers to a symbol declared by the SDK's typings
  (type checker), planted files excepted.
- **SG2 (H2/H1b):** no runtime (non-type-only) import of `fastship-sdk` in the core.
