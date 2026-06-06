# Game UI Skinning/CMS Checkpoint

Last Updated: 2026-06-06
Current Packet: P1 - Validators And Fixtures
Objective: Create a restartable, agent-runnable implementation spec for game UI skinning, CMS content, promo placements, goal seeking, and verification.

## Completed

- [x] P0 spec drafted in `docs/game-ui-skinning-cms-agent-spec.md`
- [x] P0 verification passed

## In Progress

- [ ] P1 validators and fixtures

## Pending

- [ ] P2 resolvers and diagnostics
- [ ] P3 shared shell components
- [ ] P4 promo/ad placement components
- [ ] P5 proof route and fixture toggles
- [ ] P6 editor/schema metadata follow-up
- [ ] P7 cleanup and stale-doc updates

## Next Action

Start P1 by adding `components/ui/game-ui/gameUiThemeSchema.ts`, `gameCmsSchema.ts`, `gamePlacementSchema.ts`, `gameUiFixtures.ts`, and `gameUiSchema.test.ts`.

## Files Touched By This Lane

- `docs/game-ui-skinning-cms-agent-spec.md`
- `docs/agent-checkpoints/game-ui-skinning-cms.md`

## Verification Evidence

- PASS `git diff --check`
- PASS restartability/goal-seeking scan found required sections in `docs/game-ui-skinning-cms-agent-spec.md`

## Known Constraints

- Bespoke screen code must continue to own screen layout and gameplay composition.
- JSON may skin colors, fonts, surfaces, safe content, placements, and minor component knobs.
- Do not create a general JSON layout engine.
- Do not revert unrelated user changes.

## Open Decisions

- Whether `docs/ui-template-cms-content-contract.md` should remain as a historical draft or be deprecated after P1.
