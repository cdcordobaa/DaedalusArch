# F14 `f14-hex-geocoding`: the geocoder stays outside (DEV split)

**Trap family:** vendor shape in the port, the P3r trap (`experiments/puzzle-03/puzzles/p3r-shipping-quotes`) moved to
a new setting: checking delivery addresses through a geocoding vendor SDK (`geopin-sdk`, a vendored stand-in).
Hexagonal style. **Families:** H5 (a port, and the core logic, shaped by the vendor's types, fields and precision
codes), H2/H1b (a runtime vendor dependency in the core). **Ladder:** T 2, S 3, Dst 2, Pd 0, Dx 0, rung not yet set
(the precedent is clean-shaped, as in F2, unlike P3r; the rung is left for the ladder owner to assign).

## The seed

A delivery scheduler that books every order to the address as typed, after our own format check
(`DeliveryAddress.of`, `DeliveryBooking`), and a pickup-point search that already talks to Geopin. **The precedent is
clean-shaped:** the pickup-point port `application/ports/out/PickupPoints.ts` is written in the application's types
(`PickupPoint`, `GeoPoint`), and `GeopinPickupPointsAdapter` translates to the SDK's `places({ postalCode, countryIso,
category: 'PARCEL_LOCKER' })` and back from its `placeId` / `displayName` / `location.lat` / `location.lng`.
`seed/ARCHITECTURE.md` is the P3r text, verbatim.

## The trap line

Three requests: schedule only addresses Geopin finds at rooftop or street precision with confidence of at least 0.8,
answering Geopin's spelling and the delivery point's coordinates; schedule unverified to the typed address when
Geopin is down ("the smallest change that works"); tell the customer what to fix (another country, street missing,
not found). The SDK call is one line away, so the tempting change is a port typed with the SDK
(`GeocodingPort.geocode(GeopinGeocodeRequest): Promise<GeopinGeocodeResult>`), the service building the vendor query,
reading `precision === 'LOCALITY' || 'POSTCODE'`, `components.countryIso`, `formattedAddress`, `location.lat/lng`,
and catching the vendor's `GeopinUnavailableError` (a runtime SDK import in the core). `solutions/trap/` is that tree.

## The winning line

Name the core's needs first, then let the adapter translate, as the pickup-point precedent does: the port
`AddressLookup.matchesFor(address: DeliveryAddress): Promise<AddressMatch[]>` with `AddressMatch` in our terms
(`label`, `point: GeoPoint`, `country`, our own `MatchLevel` `building` / `street` / `area`, `confidence`), the domain
error `AddressLookupUnavailable`, `AddressCheck` for the 0.8 threshold, the country rule and the customer reasons, and
`DeliveryBooking` for the verified, unverified and refused deliveries. `GeopinAddressLookupAdapter` builds the vendor
query, maps the four vendor precisions to our three levels and its outage error to ours; the service falls back to the
typed address on `AddressLookupUnavailable`. `solutions/clean/` is that tree.

## Oracle (`oracle.ts`)

The P3r oracle's rules with this vendor's vocabulary (read from `src/types/geopin-sdk.d.ts`):

- **SG1 (H5), steps `verify-address`, `rejections`:** (a) no core reference to a vendor-declared symbol; (b) no core
  import of an adapter or the composition root; (c) no core property named like a vendor-only field
  (`formattedAddress`, `precision`, `components`, `addressLine`, `postalCode`, `locality`, `countryIso`, `maxResults`,
  `placeId`, `displayName`); (d) no vendor literal (`'ROOFTOP'`, `'STREET'`, `'LOCALITY'`, `'POSTCODE'`,
  `'PARCEL_LOCKER'`, ...) as a string in the core.
- **SG2 (H2/H1b), step `geocoder-down`:** (a) no runtime import of the SDK; (b) no `require` / `import()` of it;
  (c) no core string naming a vendor declaration (an error recognised by name).

No file is excepted (no planted debt). Limits are stated in the oracle header (generic vendor names such as
`confidence`, `lat`, `lng` are not counted; a one-to-one renaming of the four precisions is not seen).

## Verification (zero calls)

Run from the repository root:

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f14-hex-geocoding --tree <tree>`
- oracle: `npx tsx experiments/trap-families/f14-hex-geocoding/oracle.ts <tree>`
- type check: the PUZZLE-03 `verify.ts` compiler options (strict, ES2022, CommonJS, node resolution, types [node]).
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset <spec.yaml> <tasks.json>`: 0 FAIL (2 WARN for
  "client", the same wording as P3r and F2).

| Tree | tsc | Tests (regression, feature) | Oracle SG1 | Oracle SG2 | Change vs seed |
|---|---|---|---|---|---|
| `seed` | 0 errors | 2/2, 0/5 | pass | pass | |
| `solutions/clean` | 0 errors | 2/2, 5/5 | pass | pass | 10 files, 143 lines |
| `solutions/trap` | 0 errors | 2/2, 5/5 | fail (14 items) | fail (1 item) | 5 files, 48 lines |

No gaming fixture is built yet; the P3r gaming shape (a renamed copy of the vendor's match shape, the outage error
recognised by name) is covered by rules SG1 (c) and SG2 (c), not yet exercised on a tree.
