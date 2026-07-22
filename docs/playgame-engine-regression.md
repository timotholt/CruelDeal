# Playgame engine regression contract

`npm run test:engine:regression` is the durable, named regression gate for
gameplay work. Run it after changing engine rules, card or location content,
runtime authority, replay, or the shared protocol. It is deliberately not the
general UI/release gate: its purpose is to make an engine regression obvious
and explainable.

Every run writes its complete, untruncated command output to
`.test-logs/engine/engine-regression-<timestamp>.log` and updates
`.test-logs/engine/latest.log`. These are local, gitignored diagnostic
artifacts; the command prints both paths at completion, including on failure.
Each log ends with a per-gate duration and total wall-clock time.

## Commands

| Command | Use | Contract |
| --- | --- | --- |
| `npm run test:engine:kernel` | Fast kernel/rules confidence | The permanent Phase 1.5 kernel and architecture contract: 33 files / 281 tests at its recorded baseline. |
| `npm run test:engine:runtime` | Runtime and replay confidence | The complete runtime suite plus the deterministic property corpus at 200 cases per property. |
| `npm run test:engine:authorities` | Match-client, authority, replay-debug, or presentation-block work | The complete player-facing contract against every registered authority test driver, plus block-delivery and debug replay presentation fences. |
| `npm run test:engine:regression` | Before handing off engine work or returning after a feature rebuild | Kernel, runtime, registered authority conformance, protocol conformance in TypeScript and Rust, generated-content drift, manifest validation, and the engine type boundary. |

To see every individual Vitest test name while investigating a failure, append
Vitest's verbose reporter to either focused suite:

```sh
npm run test:engine:kernel -- --reporter=verbose
npm run test:engine:runtime -- --reporter=verbose
```

## What the regression gate proves

| Area | Named suites / source | Regression guarantee |
| --- | --- | --- |
| Transaction kernel | `engine/kernel/*.test.ts`, `kernel/operations/stagedPlay.test.ts`, `kernel/policies/revealTiming.test.ts` | Costs, energy, hands, metadata, reveal timing, staged play, transforms, pending effects, location lifecycle, and match lifecycle are planned and committed through the governed transaction boundary. |
| Engine authority | `phase15-architecture-gates`, `phase15-mutation-boundary`, `state-api-architecture-fences`, `superseded-control-paths-architecture-fences` | No direct mutation path, stale control path, hidden state API, or policy leak re-enters the engine. |
| Determinism and replay | `phase15-frame-continuity`, `replay-snapshot-parity.stress`, `gameplay-rng-authority`, runtime `frameReplay.edge`, `projection`, `debug/replayPresentation.test.ts` | Framed history remains continuous; replay and live state agree; gameplay randomness is state-owned; projections do not disclose authority-only state; developer replay renders typed effect evidence from canonical frames. |
| Rules and reactions | `lifecycle-reaction-characterization`, `match-lifecycle-architecture-fences`, `power-ledger`, `power-restrictions` | Lifecycle/reaction ordering, match terminal handling, semantic power, and restricted location power remain governed. |
| Runtime properties | `runtime/__tests__/properties/engine-properties.test.ts` | At 200 cases per property: replay equality, exactly-once application, card provenance, per-commit fold equality, and independence from wall-clock/random sources. |
| Runtime authority | `runtime/__tests__/*.test.ts`, `characterization/*`, `contracts/*` | Bootstrap validation, session/runtime ownership, local adapter access control, projected publication, opening behavior, and reconciliation remain intact. |
| Authority independence | `client/matchClient.contract.test.ts`, `testing/authorityTestingArchitecture.test.ts`, `runtime/__tests__/localMatchSessionAdapter.test.ts`, `contexts/PlayProviders*.test.tsx`, `contexts/PlayUiInterleaving.test.tsx` | The same player-facing behaviors pass through every registered authority; no shared contract selects or imports a local implementation; clients consume one complete presentation block per public commit. |
| Content and protocol | `protocol/*.test.ts`, Rust `cruel-protocol`, manifest generators and validators | TypeScript/Rust schema agreement, generated-module freshness, and every active card/location definition remain valid. |

The permanent kernel suite and the runtime suite report their actual file/test
counts in their Vitest summaries. Do not treat a historical count as the
contract: a newly added engine regression test should increase the count and
become part of this command automatically.

## Current migration ledger

The command above is the canonical regression contract today, but it is not
yet a literal collection of every `engine/**/*.test.ts` filename. The following
eleven legacy engine files execute assertions as scripts rather than declaring
Vitest tests, so a broad Vitest collector reports “no tests” for them:

```text
engine/ai.test.ts
engine/apply.test.ts
engine/content-effects.test.ts
engine/effects/rulesInterpreter.test.ts
engine/location-primitives.test.ts
engine/manifest/manifest.test.ts
engine/projections/projections.test.ts
engine/projections/query.test.ts
engine/replay.test.ts
engine/resolve.test.ts
engine/rng/rng.test.ts
```

They are not silently claimed by `test:engine:regression`. Convert each to
`describe`/`it` suites before adding it to this contract; do not use a second
runner or a compatibility shim. Once this ledger is empty, replace the focused
kernel command with an all-active-engine Vitest collection and retain this
document as the engine test map.
