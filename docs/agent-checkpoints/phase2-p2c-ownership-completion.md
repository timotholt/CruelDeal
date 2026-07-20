# Phase 2 P2C — Ownership Completion

Status: complete

Date: 2026-07-20

## Delivered

- Moved replay cursor/follow state, replay client activity, turn-flow status,
  player-zone menus, pile selection, and the zoom-inspector target from
  `PlayBoard` or module scope into `PlayUiProvider`.
- Removed the module-global inspector signal. Card and location components
  now open the inspector through the provider contract.
- Put replay export and performance-profile reads behind nullable development
  authority. Production play has no replay/debug read surface.
- Added provider-disposal guards to command completion, committed
  subscriptions, and snapshot refreshes.
- Pending end-turn waits now resolve to `null` during disposal rather than
  hanging or publishing into an obsolete provider generation.

## Proofs

- Overlay state is reset across an actual provider unmount/remount.
- A pending remote-player turn wait settles when the provider is disposed.
- Architecture fences reject module-scope inspector state, board-local Solid
  signals, and ungated replay authority.
- The P2B canonical-type/import fences remain green.

## Verification

- Split-provider behavior and architecture tests: **2 files, 11 tests
  passed**.
- Play/provider focused regression tests: **24 tests passed**.
- Strict ESLint over the P2C production/test files: **zero warnings**.
- Production build and `git diff --check`: **passed**.

Phase 2 is now closed. The next planned phase is Phase 3a: make the
presentation director the sole committed-frame iterator and remove remaining
DOM-host concerns from `PlayScriptCtx`.
