# Cruel Deal UI Salvage Audit

Date: 2026-07-17  
Recovery baseline: `a56f864` (`chore: snapshot UI authoring work before salvage audit`)

## Purpose

This audit separates working game/product behavior from accumulated presentation experiments so the metagame UI can move forward without destabilizing the card match.

The immediate target is phone-first metagame UI:

- login
- home / mission briefing
- deckbuilding and collection
- store
- season, profile, inbox, history, settings, and progression

The match UI is a protected subsystem for the MVP. Its current animations and working game behavior are not redesign targets.

## Coverage

The recovery commit includes the complete tracked and untracked worktree that was present at the start of the audit: 48 changed files, 3,309 additions, and 514 deletions.

The repository audit covered:

- every top-level tracked file family
- all production and development routes
- production-reachable imports from `index.tsx`
- all screen, context, service, style, test, and public-asset families
- build, focused test, full test-discovery, and lint health
- the supplied visual references and the running application at the primary routes

Repository scale at the baseline:

| Family | Tracked files |
| --- | ---: |
| `services` | 544 |
| `components` | 417 |
| `public` | 177 |
| `docs` | 127 |
| `cards` | 15 |
| `documents` | 14 |
| `hooks` | 13 |
| `src` | 11 |
| other roots and configuration | 61 |

The active source contains roughly 484 TypeScript files, 212 TSX files, 24 CSS files, and 104 files named as tests/specs. The production entry point can statically reach roughly 637 local modules because authoring tools are imported alongside the product.

## Executive finding

The card game is not blocked by a lack of CSS controls. It is blocked by the absence of one decided metagame design language and one clean product boundary.

At least seven presentation or authoring families coexist:

1. the older indigo/slate metagame screens
2. the Mission Briefing semantic runtime
3. the Main Material editor
4. the generic Material Lab
5. the Game UI skin/CMS proof
6. the Shiny/Kan/reflex material system
7. the city-map/tensor experiments

Several of those experiments are statically imported into the application, and two large editor stylesheets are directly imported by product UI. This makes every styling decision feel global, fragile, and difficult to reason about.

The CSS editor was a reasonable experiment, but it is now solving the wrong problem. More editing controls cannot decide what Cruel Deal should look like. A style interview, a short approved style charter, and one representative implementation slice should come first.

## Product route map

| Route | Current purpose | Functional value | Presentation status | Recommended disposition |
| --- | --- | --- | --- | --- |
| `/` | Mission Briefing home | High | Strongest current metagame direction | Preserve as visual anchor; simplify dependencies |
| `/game` | older direct match | Unclear / legacy | Isolated match presentation | Protect for now; determine later whether it remains a supported route |
| `/play` | deck picker into engine-backed match | High | Match UI is MVP-worthy; picker is debug-like | Preserve match; replace entry experience later |
| `/play/legacy` | alias to current classic play screen | Low | Duplicate route | Remove only after route intent is confirmed |
| `/deck` | deckbuilding and collection | High | Older indigo/slate family | Preserve behavior; reskin/recompose |
| `/store` | offers and purchases | High | Older indigo/slate family | Preserve data flow; reskin/recompose |
| `/season` | season pass | Medium/high | Older indigo/slate family | Preserve behavior; redesign after core slice |
| `/profile` | player profile | Medium | Older indigo/slate family | Preserve content; redesign later |
| `/inbox` | messages | Medium | Older indigo/slate family | Preserve content; redesign later |
| `/history` | activity history | Medium | Older indigo/slate family | Preserve content; redesign later |
| `/settings` | settings | Medium | Older indigo/slate family | Preserve behavior; redesign later |
| `/rank` | ladder ranking | Medium | Older indigo/slate family | Preserve content; redesign later |
| `/progression` | progression rewards | Medium/high | Older indigo/slate family | Preserve behavior; redesign after core slice |
| `/citymap` | parked city experiment | Low for MVP | Separate experimental family | Isolate from the product bundle |

The router also exposes numerous editor/proof routes, including material editors, semantic node previews, card proofs, shiny authoring, performance proofs, and tensor tools. These are useful development artifacts but are not product screens.

## What is worth saving

### Protect

- the engine-backed match behavior reached through `/play`
- the current in-match animation and interaction work
- the match-specific UI and CSS boundary
- card definitions, rules, manifest machinery, presentation choreography, and VFX
- the working user, store, season, progression, and deck data flows
- the recovery commit itself

### Salvage directly

- `UserContext` and `UIContext` behavior
- the mock API/service gateway as the current product data seam
- deck selection, card filtering, add/remove, and deck mutation logic
- store offer grouping, purchase flow, scroll targeting, and purchase overlays
- season/progression data and claiming behavior
- the Mission Briefing composition and semantic runtime
- the K/Kan emblem and gold/reflex rendering work
- the phone viewport assumption
- useful shared cards, currency displays, progress indicators, and navigation destinations

### Salvage as reference, not as production architecture

- visual recipes and experiments from Main Material
- Material Lab texture/lighting investigations
- Game UI skin/CMS proof concepts
- shiny authoring and performance controls
- login material previews
- canonical card and typography proofs

These tools contain discoveries, but the product should consume a small approved result—not carry an entire editor runtime.

### Isolate

- all authoring and lab screens
- semantic compiler and export tooling that is not needed at runtime
- Main Material DOM inspectors, node editors, persistence controls, CSS probes, and export panels
- Material Lab editor UI and schemas
- Shiny authoring/performance screens
- Game UI skin proof screens
- city-map/tensor experiments and imported upstream backups
- asset-foundry tools

Isolation initially means removing them from normal production imports and navigation, not deleting them.

### Retire after confirmation

- the generic indigo/purple “sci-fi dashboard” presentation
- debug controls embedded in production deck/play flows
- duplicate path interception in `App.tsx`
- duplicate or ambiguous match routes
- editor CSS imported by product components
- remote duplicate font imports
- global styling rules such as `html { font-size: 130%; }` that silently affect every screen
- global scroll-bar hiding and selection disabling where they are not product requirements

## Strongest visual anchor

The Mission Briefing is the closest current screen to the supplied references and the clearest basis for a Cruel Deal metagame identity.

Elements already supported by the user's stated preferences:

- black/charcoal base
- restrained warm gold as the primary signal color
- the K/Kan emblem
- cinematic mission presentation
- condensed, editorial typography
- metallic/reflex effects used as emphasis
- phone-first composition

The reference set also repeatedly uses:

- hard-edged or clipped panels rather than soft generic cards
- thin technical rules and small uppercase labels
- a clear hierarchy between cinematic image, mission title, and actionable information
- limited cyan/blue for data or secondary currency
- gold concentrated on selected, active, premium, or actionable states

These are observations to validate in the interview, not yet a final style specification.

## Root causes

### 1. Product CSS imports editor CSS

`MainMenuScreen.tsx` imports the approximately 2,061-line Main Material preview stylesheet.

`NavigationBar.tsx` imports the approximately 2,258-line Material Lab stylesheet and uses a Material Lab panel.

The product is therefore coupled to the visual authoring environment.

### 2. Development tools are statically bundled

`router.tsx` imports product screens and many heavy development/editor screens at module load time. The entry graph reaches hundreds of editor, city-map, tensor, semantic, and material modules.

The current production build succeeds, but its main JavaScript bundle is roughly 2.5 MB minified, its CSS is roughly 603 KB, and the city-map chunk is roughly 552 KB. Vite reports oversized chunks.

### 3. Routing has two owners

TanStack Router owns product and many dev routes, while `App.tsx` separately inspects `window.location.pathname` and renders another nested tree of development screens.

This duplication makes route ownership and authentication boundaries difficult to see.

### 4. Typography and global CSS have no single policy

The application bundles IBM Plex Sans Condensed, Barlow Condensed, and JetBrains Mono locally while also importing additional Google-hosted fonts from global CSS.

Typography differs by subsystem:

- Mission Briefing: Barlow Condensed and IBM Plex Sans Condensed
- match UI: Unica One, Inter, and JetBrains Mono
- login: JetBrains Mono plus provider-specific fonts
- older metagame: Tailwind defaults and local overrides

The interview should decide metagame typography. Match typography may remain separate.

### 5. Functional screens and presentation are intermixed

Deck, store, season, profile, and related screens contain useful product behavior but encode the older presentation directly in component markup. They are candidates for careful decomposition, not deletion.

## Stylesheet concentration

The largest style files show where complexity accumulated:

| Stylesheet | Approx. lines | Role |
| --- | ---: | --- |
| `src/styles/ui-material-lab.css` | 2,258 | generic material authoring/lab |
| `src/styles/main-material-preview.css` | 2,061 | Main Material editor and current home dependency |
| `src/styles/playgame.css` | 1,712 | protected match UI |
| `components/screens/play/city-map/cityMapStyles.css` | 1,123 | city-map experiment |
| shiny performance styles | 393 | metallic performance proof |
| minimal material proof | 355 | surface experiment |
| card styles | 293 | card presentation |
| login styles | 291 | current login |
| generated semantic appearance | 286 | Mission semantic output |

The problem is not simply the number of CSS lines. It is the lack of a boundary between product styles, generated runtime styles, proofs, and editor controls.

## Asset findings

The public asset library is authoring-heavy: approximately 177 tracked files, including more than 120 texture files, multiple PBR material sets, maps, login art, UI assets, and gold treatments.

Only a small subset is needed for the metagame MVP. The correct next step is to select a canonical asset set after the style interview:

- one login/brand image direction
- one home/mission background direction
- one portrait treatment
- one K/Kan mark
- one approved gold material
- one restrained secondary data color
- a small icon family

Unused textures should remain available as source material but should not drive component architecture.

## Verification health

### Confirmed green

- `npm run build`
- focused semantic compiler/runtime, Mission Briefing, and shiny tests: 13 files and 45 tests passed
- recovery diff whitespace validation

### Full-suite findings

The unrestricted Vitest command is not currently a trustworthy single health signal:

- 255 real Vitest assertions passed
- 96 files were reported as failed
- most failures are script-style `.test.ts` files with no Vitest `test()`/`it()` suite
- test discovery also crawls `.claude/worktrees/funny-lamarr-7b25dc`, duplicating an older worktree
- active source also showed a card-manifest count mismatch and a city-map landmark invariant failure during the run

This is test-infrastructure and experimental-subsystem debt. It does not invalidate the focused green tests or the successful build.

### Lint findings

The unscoped lint command fails with 620 reported problems (269 errors and 351 warnings). It also scans the nested worktree and imported/experimental tensor code. Product lint needs explicit scope and ignores before it can serve as a release gate.

## Recommended order of work

1. **Recovery snapshot** — complete at `a56f864`.
2. **Repository and route audit** — complete in this document.
3. **Visual-style interview** — establish specific likes, dislikes, emotional target, density, typography, imagery, gold usage, and navigation behavior.
4. **Style charter** — write a short, testable design agreement with examples and anti-examples.
5. **Final salvage map** — apply the charter to decide what stays, adapts, isolates, archives, or retires.
6. **One vertical slice** — build a real phone flow, recommended as Login → Mission Briefing → Deck entry, without changing match UI.
7. **Extract the small system** — only after the slice feels right, extract tokens and a limited set of primitives.
8. **Expand deliberately** — deck/collection, store, then secondary screens.
9. **Production separation** — lazy-load or remove authoring routes from the product graph and establish scoped verification.

The missing step in the original proposed order was the vertical slice before system-building. The style should be proved in a real product flow before creating another general-purpose design system or editor.

## Interview gate

No broad metagame reskin should begin until the interview produces agreement on:

- desired emotional tone
- which supplied reference is closest and which is furthest away
- dark versus bright world balance
- gold material and frequency
- acceptable information density
- typography character and readability
- use of people/character art
- panel geometry and depth
- motion intensity
- navigation model
- how “cruel,” luxurious, corporate, dangerous, and cyberpunk should balance

The output should be a one-page style charter, not another editor.
