# Clinic appointments service

Hexagonal (ports and adapters) TypeScript service. The architecture is declared in `architecture.yaml`:
`src/domain`, `src/application`, `src/adapters/inbound`, `src/adapters/outbound`, `src/config` (composition root).
No web framework: inbound adapters are plain request handlers (`{ method, path, body } -> { status, body }`).
Type-check with `npx tsc --noEmit`.
