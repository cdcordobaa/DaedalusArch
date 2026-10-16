# Hexagonal fixture (v1.3)

Two small projects laid out for `presets/hexagonal.yaml` (`src/domain`, `src/application`, `src/adapters/inbound`,
`src/adapters/outbound`, `src/config`).

- `clean/` follows the allowed-dependency graph: the port `OrderRepository` lives in the core and
  `InMemoryOrderRepository` (outbound adapter) implements it; the controller calls the inbound port `PlaceOrderPort`;
  only `config/compositionRoot.ts` wires them.
- `violating/` adds five defects: the core imports an outbound adapter (`Order` -> `SqlOrderGateway`: dependency
  direction and core isolation); the use case imports and injects a concrete adapter (`PlaceOrderUseCase`:
  dependency direction and port dependency inversion); the controller imports an outbound adapter (sideways, layer
  skip); `SqlOrderGateway` implements no port (port-adapter pattern).
