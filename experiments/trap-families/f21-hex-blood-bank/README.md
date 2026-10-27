# F21 `f21-hex-blood-bank`: the blood supplier stays outside (DEV split)

**Trap family:** vendor shape in the port, the P3r trap (`experiments/puzzle-03/puzzles/p3r-shipping-quotes`) moved to
a new setting: a hospital blood bank that orders units from a regional blood supplier through the supplier's SDK
(`haemalink-sdk`, a vendored stand-in). Hexagonal style. **Families:** H5 (a port, and the core logic, shaped by the
supplier's order and receipt types, field names, product / RhD / priority codes, allocation status strings and embargo
codes), H2/H1b (a runtime vendor dependency in the core, through the supplier's embargo error class). **Ladder:** T 2,
S 3, Dst 2, Pd 0, Dx 0, rung not yet set (the precedent is clean-shaped, unlike P3r; the rung is left for the ladder
owner).

Only the trap mechanism is shared with P3r. The story, entities, steps and code structure are new: one use case
(`RequestUnitsService`) with our own fridge (`needs/Fridge`) as its outbound need, a ward request checked in a fixed
order (`UnitRequest`: ward, component, group, units), blood groups and components as the core's own types, a
`Fulfilment` that owns the status rules, a delivery follower as the clean precedent, a ward terminal as the inbound
side (`WardTerminal`), and the composition root `src/config/bootstrap.ts` (which takes the fridge stock as an option).
**The leak varies from P3r:** besides SDK types, step `embargo` tempts the vendor's **error class**
(`HaemalinkEmbargoError`) and its **status strings** (`embargoCode` `'REGIONAL_SHORTAGE'` / `'TTI_QUARANTINE'`,
`allocationStatus` `'BACKORDERED'` / `'PART_ALLOCATED'`) into the core, where the answer must speak our own outcomes
(`status: 'on hold'`, `holdReason: 'shortage' | 'quarantine'`).

## The seed

Wards ask for units of one component (red cells, platelets, plasma) and one blood group (`request({ ward, component,
group, units, urgent })`). Our checks refuse a bad request first; the fridge gives what it has; the rest is outstanding,
with status `'filled'`, `'partly filled'` or `'unfilled'`. **The precedent is clean-shaped:** the delivery port
`application/needs/Deliveries.ts` is written in the application's type (`DeliveryUpdate`, `DeliveryState`: `'being
packed' | 'on the way' | 'delivered'`), and `HaemalinkDeliveries` translates from the SDK's `consignment(orderRef)`
stages `'PICKING'`, `'DISPATCHED'`, `'DELIVERED'` and `stageAt`. `seed/ARCHITECTURE.md` is the P3r text, verbatim.

## The trap line

Three requests: order what the fridge cannot give from Haemalink (emergency priority when urgent, partial confirmation
allowed); on a supplier embargo answer `'on hold'` with our reason and the lift time and leave that component and group
alone until then ("the smallest change that works"); cover urgent red cells with O negative, from the fridge and then a
second emergency order. The SDK call is one line away, so the tempting change is a port typed with the SDK
(`SupplierOrders.submit(HlOrderRequest): Promise<HlOrderReceipt>`), the service building `{ priority: 'STAT', lines: [{
product: 'RBC', abo, rhd: 'NEG', qty }] }`, reading `allocations[0].allocationStatus === 'BACKORDERED'` and
`qtyAllocated`, catching `HaemalinkEmbargoError` (a runtime SDK import in the core), mapping `embargoCode` to our reason
in the service and keeping `liftsAt`. `solutions/trap/` is that tree.

## The winning line

Name the core's needs first, then let the adapter translate, as the delivery precedent does: the port
`Supplier.order(SupplyOrder): Promise<SupplyConfirmation>` in our terms (component, group, units, urgent; order number,
units confirmed), the domain errors `SupplyHeld(hold: { reason, until: Date })` and `SupplierFailed`, a `SupplyHolds`
register, `Cover.takesONegativeCover` and `Fulfilment` extended with the hold precedence. `HaemalinkSupplier` builds
the vendor order, reads the allocation, maps the embargo error and its code to `SupplyHeld` and any other vendor error
to `SupplierFailed`. Stock is taken only at the end of a request, so a failed order takes none. `solutions/clean/` is
that tree.

## Requests: refusal and precedence rules stated (all exercised by `tests/behaviour.ts`)

- `supplier-orders`: our checks run first, in the order ward, component, group, units, and refuse without taking units
  or asking Haemalink; the fridge is used first; only the shortfall is ordered, in one order with one line; a request
  the fridge covers does not ask Haemalink (`supplierOrder: null`); urgent means emergency priority, all else routine;
  `'filled'` (nothing outstanding), `'unfilled'` (nothing given), `'partly filled'` otherwise; a Haemalink failure fails
  the request and takes none of our stock.
- `embargo`: an embargo does not fail the request; fridge units are still given; reasons `'shortage'` /
  `'quarantine'`; `holdUntil` is the lift time (ISO 8601); no new order for that component and group until the lift
  time has passed (other components and groups as usual); status precedence `'filled'` > `'on hold'` > `'unfilled'` /
  `'partly filled'`; hold fields null for any request that met no hold, including one the fridge covers; any other
  failure fails the request, holds nothing, and the next request asks again.
- `o-negative-cover`: only urgent red cell requests of a group other than O negative; the O negative fridge first, then
  a second emergency order; `substituted` counts both, `fromStock` / `fromSupplier` only the requested group;
  `coverOrder` vs `supplierOrder`; no O negative order when the fridge covers it; a held own group is still covered
  without asking for it, and keeps its hold fields; O negative holds work as any other group, but never set the hold
  fields or `'on hold'`; substituted units count as given; a failed O negative order (not an embargo) fails the whole
  request and takes none of our stock.

## Oracle (`oracle.ts`)

The P3r oracle's rules with this vendor's vocabulary (read from `src/types/haemalink-sdk.d.ts`):

- **SG1 (H5), steps `supplier-orders`, `embargo`, `o-negative-cover`:** (a) no core reference to a vendor-declared
  symbol; (b) no core import of an adapter or the composition root; (c) no core property named like a vendor-only field
  (`orderRef`, `qtyRequested`, `qtyAllocated`, `allocationStatus`, `lineNo`, `etaMinutes`, `embargoCode`, `liftsAt`,
  `httpStatus`, `stageAt`, `courierId`, `clinicalNote`, `siteCode`); (d) no vendor literal (`'RBC'`, `'PLT'`, `'FFP'`,
  `'POS'`, `'NEG'`, `'STAT'`, `'ROUTINE'`, `'ALLOCATED'`, `'PART_ALLOCATED'`, `'BACKORDERED'`, `'PICKING'`,
  `'DISPATCHED'`, `'DELIVERED'`, `'REGIONAL_SHORTAGE'`, `'TTI_QUARANTINE'`) as a string in the core. The ABO letters
  are left out (blood bank vocabulary).
- **SG2 (H2/H1b), step `embargo`:** (a) no runtime import of the SDK; (b) no `require` / `import()` of it; (c) no core
  string naming a vendor declaration (the embargo error recognised by name).

No file is excepted (no planted debt). Limits are stated in the oracle header: plain blood bank and ordering words
(`abo`, `rhd`, `product`, `priority`, `lines`, `qty`, `allocations`, `stage`) are not counted as fields; codes rebuilt
from pieces or matched by substring are not seen by (d); a one-to-one mirror of the vendor's codes under our spelling is
not seen; a vendor error passing through the core untouched is not counted; where holds are remembered is not judged.

## Gaming fixture (`gaming/renamed-vendor-shape/`)

The port declares its own copy of the supplier's order and receipt (`SupplyRequest` with `lines` of `product` / `abo` /
`qty`; `SupplyReceipt` with `orderRef` and `allocations[].qtyAllocated` / `allocationStatus`), the adapter maps the
codes but passes the vendor's receipt through, and the service recognises the embargo by `e.name ===
'HaemalinkEmbargoError'`, reads `embargoCode` / `liftsAt`, and tells the reason with `includes('SHORTAGE')`. No SDK
import, no vendor literal in the core. Tests pass; rules SG1 (c) and SG2 (c) catch it.

## Verification (zero calls)

Run from the repository root:

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f21-hex-blood-bank --tree <tree>`
- oracle: `npx tsx experiments/trap-families/f21-hex-blood-bank/oracle.ts <tree>`
- type check: the PUZZLE-03 `verify.ts` compiler options (strict, ES2022, CommonJS, node resolution, types [node]).
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset <spec.yaml> <tasks.json>`: 0 FAIL (7 WARN:
  "client" twice, as in P3r and F17, and "component" five times, the blood bank's own word for red cells, platelets and
  plasma).

| Tree | tsc | Tests (regression, feature) | Oracle SG1 | Oracle SG2 | Change vs seed (`diff -ruN`) |
|---|---|---|---|---|---|
| `seed` | 0 errors | 3/3, 0/13 | pass | pass | |
| `solutions/clean` | 0 errors | 3/3, 13/13 | pass | pass | 10 files, +162 / -10 lines |
| `solutions/trap` | 0 errors | 3/3, 13/13 | fail (29 items) | fail (1 item) | 5 files, +76 / -7 lines |
| `gaming/renamed-vendor-shape` | 0 errors | 3/3, 13/13 | fail (7 items) | fail (1 item) | 5 files, +99 / -7 lines |

Test limits: the end of a hold is exercised with a lift time 300 ms ahead and a 400 ms wait (real clock); a request the
fridge covers in full during a hold of its own component and group cannot be set up through the app (a hold is only
met once that stock is used up), so the "filled, hold fields null" rule is exercised on another component of the same
group; the exact lift instant (equal to now) is not exercised; the ward terminal is not exercised.
