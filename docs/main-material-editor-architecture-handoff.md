# Main Material Editor Architecture Handoff

Last updated: 2026-06-12

## Goal

The `/main-material` editor is being converged toward a restartable architecture:

```txt
validated authoring schema / metadata
  -> editor controls
  -> authoring JSON
  -> runtime/export contracts
  -> product renderers
```

The direction is to keep editor state, product rendering, export contracts, and
compatibility adapters separated. New work should prefer small pure modules with
tests over adding more logic to `MainMaterialPreviewScreen.tsx`.

The active control-trust plan lives in
`docs/main-material-editor-control-contract-spec.md`. Use that document as the
restartable inventory for visible controls, seams, output effects, proof levels,
and the next acceptance slice.

## Current State

`MainMaterialPreviewScreen.tsx` is still large, but many high-risk systems have
been extracted:

- Feed model/defaults/sanitizers: `components/screens/main-material/mainMaterialFeedModel.ts`
- Feed text/render policy: `components/screens/main-material/mainMaterialFeedText.ts`
- Feed authoring controls: `components/screens/main-material/mainMaterialFeedEditors.tsx`
- Feed node operations/templates: `mainMaterialNodeTreeOperations.ts`, `mainMaterialNodeTemplates.ts`
- Target id parsing and selection: `materialTargetIds.ts`, `mainMaterialSelectionModel.ts`
- Workbench list construction: `mainMaterialWorkbenchModel.ts`
- DOM registry/audit/export groups: `mainMaterialDomRegistry.ts`, `mainMaterialDomAudit.ts`, `mainMaterialDomExportGroup.ts`
- Export group descriptors/coverage: `mainMaterialExportGroups.ts`, `mainMaterialExportCoverage.test.ts`
- CSS probe resolution: `mainMaterialCssProbeTargets.ts`
- Compatibility fallback export: `mainMaterialCompatibilityExport.ts`
- Feed CMS content output: `mainMaterialFeedContentOutput.ts`

## Export DOM/CSS

The normal inspector path is now live-DOM only.

- The selected editor target resolves to an export group descriptor.
- The descriptor gives the DOM root target id.
- The DOM registry finds the live mounted element.
- `mainMaterialDomExportGroup.ts` serializes that live subtree to:
  - DOM HTML
  - CSS collected from class rules and inline styles
  - metrics
  - contained `data-material-target-id`s

The old emission planner remains only as a compatibility/offline adapter:

- `mainMaterialExportPlanner.ts`
- `mainMaterialCompatibilityExport.ts`

Do not reintroduce this fallback into the normal screen inspector path unless
there is a deliberate offline export mode with its own UI and tests.

## CMS Content

Feed story CMS values now have a registered output path:

- `mainMaterialFeedContentOutput.ts` converts a `FeedStory` into
  `ui-node-content`.
- Serialization goes through `serializeEditorOutput('ui-node-content', ...)`.
- Import goes through `validateEditorOutput('ui-node-content', ...)`.
- Only known feed content fields are applied back to the story.
- Unknown keys are ignored.
- Invalid JSON or invalid content returns a message instead of crashing the
  route.

In the UI, selected feed nodes show:

- bound/static state
- content field type
- preview value
- copy `ui-node-content`
- inline `Content JSON` editor
- apply/format/reset controls
- inline document status
- live dirty-document validation
- changed matching-field count

The selected-field textarea still exists as a convenience edit path for the
currently bound node. The intended future direction is for the document editor
to become the primary CMS authoring surface.

## Surface Editor

Most high-risk `MaterialRecipeEditor` sections now use schema/metadata-driven
controls through `SurfaceGeneratedEditor` and `surfaceFieldMetadata.ts`.

Important behavior already fixed:

- Edge wear has explicit enable/disable behavior.
- Texture scale uses discrete stops.
- Blur does not require glass to be enabled.
- Base shape/bevel and border were separated enough to remove the feeling that
  bevel randomly toggles border.

When adding controls, put labels/options/ranges/dependencies in metadata where
possible instead of custom JSX.

## Tests To Run

Focused tests for this lane:

```bash
npx tsx components/screens/main-material/mainMaterialFeedContentOutput.test.ts
npx tsx components/screens/main-material/mainMaterialExportCoverage.test.ts
npx tsx components/screens/main-material/mainMaterialDomExportGroup.test.ts
npx tsx components/screens/main-material/mainMaterialCssProbeTargets.test.ts
npx tsx components/screens/main-material/mainMaterialEmissionOutput.test.ts
npx tsx components/screens/main-material/mainMaterialCompatibilityExport.test.ts
npx tsx components/ui/editor-output/editorOutputRegistry.test.ts
npx vitest run components/ui/material-lab/SurfaceFieldControl.render.test.tsx
npm run build
```

Useful browser smoke target:

```txt
http://localhost:3000/main-material
```

Expected smoke signals:

- no `CRITICAL ERROR`
- material targets mount with `data-material-target-id`
- Export DOM/CSS reads from live selected DOM groups
- generated controls reach live Export CSS; verified on 2026-06-12 by changing
  `Glass Blur` from `3` to `7` on
  `feed:card:card_type_01:node:mission-briefing` and observing
  `--glass-blur: 7px` in the selected surface style and active Export CSS panel
- layout center pin semantics are browser-proven for Mission Briefing:
  `Pin V = center` centers the node, then `Y Offset = 10` moves its center
  exactly `10%` of the parent height below center and updates Export CSS
- absolute `W/H fill` is browser-proven for Mission Briefing: the real fill
  buttons activate, size sliders disable, live geometry fills the parent on
  both axes, and Export CSS emits `width: 100%` plus `height: 100%`
- `Pad`, `Line Gap`, and `Spread Y` are browser-proven for Mission Briefing:
  the real controls compute `padding: 24px`, `gap: 18px`, and
  `justify-content: space-between`, with matching Export CSS declarations/vars
- CMS panel shows `Content JSON`, `apply document`, `format`, `reset`, and
  status
- invalid CMS JSON disables `apply document`
- valid dirty CMS JSON shows matching-field changed count

## Known Risks

- `MainMaterialPreviewScreen.tsx` remains too large. Prefer extracting more
  controller logic rather than adding local branches.
- The compatibility export planner is still present. It should stay isolated
  unless/until a true offline export mode is productized.
- The CMS document editor still uses a plain textarea. It now formats JSON,
  validates dirty drafts live, and shows a changed matching-field count, but it
  does not yet provide schema-aware field controls or per-field error locations.
- The selected-field textarea is now labeled as a selected-field convenience
  editor, but it still duplicates part of the document edit workflow.
- Browser smoke tests depend on the dev server already running at
  `localhost:3000`.

## Recommended Next Steps

1. Follow `docs/main-material-editor-control-contract-spec.md` and start the
   `feed-layout-proof` slice:
   - tie center pin + x/y offset behavior to resolver tests and browser
     geometry evidence
   - absolute fill sizing is now proven
   - W/H hug is now proven: real `/main-material` controls activate, size
     sliders disable, live style/Export CSS emit `width: max-content` and
     `height: auto`, and browser geometry confirms `H hug` shrinks to content
     height while `W hug` follows intrinsic content width and may exceed the
     parent
   - pad/gap/spread are proven for column direction; row-direction distribution
     is now proven through pure control-mapping tests, feed-to-node bridge
     coverage, browser geometry, and Export CSS evidence from real row controls
   - fixed W/H size, flow/in-flow mode, footer/pin-end, and nudge are now
     proven through pure tests, feed-to-node bridge tests, browser geometry, and
     Export CSS evidence
   - root feed layout controls now share tested defaults/clamps/CSS-var helpers
     for Content Y, Copy Lift, and Dot Gap; browser proof for the actual sliders
     is still pending
   - inspector tab payload selection is now contract-tested for Export DOM,
     Export CSS, Editor DOM, and Frame CSS; browser proof for visible inspector
     controls is still pending
2. Continue shrinking `MainMaterialPreviewScreen.tsx`:
   - move CMS document actions into a controller module
   - move reset/import/export orchestration out of the screen
3. Split the large `FeedRecipeEditor` into focused child editors for CMS
   document editing, structure operations, layout, and selected-node text.
4. Decide whether the selected-field textarea should remain as an inline
   convenience editor or move behind an explicit edit mode.
5. Add schema-aware CMS field controls or field-level diagnostics on top of the
   current validated JSON document path.
6. Add a real offline export mode only if needed, using
   `mainMaterialCompatibilityExport.ts`.
7. Keep updating this document and
   `docs/agent-checkpoints/editor-architecture-convergence.md` after each
   meaningful architecture slice.
