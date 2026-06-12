# Main Material Editor Architecture Handoff

Last updated: 2026-06-11

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

1. Continue shrinking `MainMaterialPreviewScreen.tsx`:
   - move CMS document actions into a controller module
   - move reset/import/export orchestration out of the screen
2. Split the large `FeedRecipeEditor` into focused child editors for CMS
   document editing, structure operations, layout, and selected-node text.
3. Decide whether the selected-field textarea should remain as an inline
   convenience editor or move behind an explicit edit mode.
4. Add schema-aware CMS field controls or field-level diagnostics on top of the
   current validated JSON document path.
5. Add a real offline export mode only if needed, using
   `mainMaterialCompatibilityExport.ts`.
6. Keep updating this document and
   `docs/agent-checkpoints/editor-architecture-convergence.md` after each
   meaningful architecture slice.
