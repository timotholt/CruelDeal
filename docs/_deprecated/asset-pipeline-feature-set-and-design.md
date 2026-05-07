# Asset Pipeline MVP Feature Set And Design

## Goal

Build the cheapest useful asset pipeline first: generate candidate images, approve or reject them quickly, and promote approved files into the Vite build without introducing production infrastructure.

The repo is already Solid + TanStack Router/Query. The active game manifest is `services/playgame/engine/manifest/content/cyberpunk-cards.ts`, loaded by `services/playgame/engine/manifest/card-loader.ts`. The old `services/playgame/engine/manifest/cards/*/card.json` files are retained but not loaded.

## Current Asset Audit

| Asset class | Current state | Build path |
| --- | --- | --- |
| Location images | 10 active locations have old files, but current source art is deprecated after the cyberpunk pivot. Treat all location art as needing replacement. | `public/art/maps/*.png` today |
| Card front images | 106 active card portrait paths are empty. | Proposed: `public/art/cards/{defId}/portrait.webp` |
| Card backs | No shipped image asset; face-down cards are CSS gradients today. | Proposed: `public/art/cards/backs/default.webp` |

## Image Specs

All committed bitmap dimensions should be divisible by 8 in both dimensions so older Android texture/upload paths, especially Android 7-class devices, have easy dimensions to render.

| Asset class | Aspect ratio | Recommended committed size | Notes |
| --- | --- | --- | --- |
| Card front portrait | 5:7 | `640x896` | Default mobile/runtime card art. Both dimensions divisible by 8, exact 5:7, and large enough for hand, board, and most inspector views. |
| Card front source/master | 5:7 | `1024x1432` | Higher-quality source size for regeneration or zoom-heavy use. Both dimensions divisible by 8 and exact 5:7. |
| Card back | 5:7 | `640x896` | Same geometry as runtime card fronts. Use `1024x1432` only if the back needs extra polish for zoomed inspection. |
| Location/lane art | 4:15 | `384x1440` | Current-code lane overlay size. The map covers enemy slots + gap + location strip + gap + player slots, not just the location tile. Both dimensions divisible by 8. |
| Location/lane low-memory | 4:15 | `320x1200` | Cheaper fallback with the same ratio and divisible-by-8 dimensions. |

Provider generation can use the nearest supported native size, then the local pipeline crops/resizes/pads to the committed size above before approval or promotion. Never rely on provider output size being build-ready.

Current Midjourney map files are `576x2016`, but they are no longer art-direction relevant after the cyberpunk pivot. Do not treat them as source/master art for the new pipeline.

Normalize new generated location art to `384x1440` for mobile runtime. That better matches the current overlay and avoids relying on runtime cover-cropping. If memory pressure shows up on older Android devices, drop lane runtime assets to `320x1200`.

Current location assets:

- `cathedral`: `public/art/maps/Cathedral.png`
- `cathedral-cloister`: `public/art/maps/Cathedral2.png`
- `jungle-trail`: `public/art/maps/Jungle.png`
- `food-court`: `public/art/maps/FoodCourt.png`
- `hackers-lair`: `public/art/maps/HackersLair.png`
- `icy-road`: `public/art/maps/IcyRoad.png`
- `science-lab`: `public/art/maps/Laboratory.png`
- `lava-flow`: `public/art/maps/LavaFlow.png`
- `tropical-beach`: `public/art/maps/TropicalBeach.png`
- `alien-starship`: `public/art/maps/AlienStarship.png`

## Game Engine Boundary

The game currently hard-codes asset paths inside TypeScript data that the engine consumes:

- Cards: `services/playgame/engine/manifest/content/cyberpunk-cards.ts`
- Locations: `services/playgame/engine/manifest/content/locations.ts`

Keep that boundary. The game engine should only know about final build asset paths such as `/art/cards/scrap-rat/portrait.webp` or `/art/maps/HackersLair.webp`. It should not know about prompts, approvals, provider IDs, retries, rejection notes, cost estimates, or raw generated candidates.

External-to-engine workflow state should live in tooling-only files:

- `asset-workbench/state.json`: approval ledger, prompts, provider request metadata, candidate status, reviewer notes.
- `asset-workbench/presets.json`: reusable style presets and negative prompts.
- `public/art/generated/...`: local previewable generated candidates.
- `public/art/cards/...` and `public/art/maps/...`: final promoted runtime files only.

Promotion is the only step allowed to touch game-facing paths. Promotion copies a normalized approved bitmap into its build location and, when needed, updates the relevant hard-coded TS asset path.

Missing card front assets:

- `scrap-rat`: Scrap Rat, Merc, 1/1
- `crash-dummy`: Crash Dummy, Drone, 1/2
- `chop-doc`: Chop Doc, Bio, 2/2
- `grinder-crew`: Grinder Crew, Merc, 2/3
- `redline-bruiser`: Redline Bruiser, Merc/Bio, 3/3
- `parts-collector`: Parts Collector, Merc, 3/4
- `rust-revenant`: Rust Revenant, Bio, 4/6
- `bone-market`: Bone Market, Tech, 4/4
- `meat-grinder`: Meat Grinder, Tech, 5/6
- `scrapyard-king`: Scrapyard King, Merc, 6/8
- `middle-manager`: Middle Manager, Corp, 2/2
- `hostile-recruiter`: Hostile Recruiter, Corp, 3/3
- `golden-parachute`: Golden Parachute, Corp, 1/1
- `severance-clone`: Severance Clone, Corp/Bio, 2/1
- `hr-algorithm`: HR Algorithm, AI/Corp, 3/2
- `acquisition-team`: Acquisition Team, Corp, 4/5
- `boardroom-proxy`: Boardroom Proxy, Corp/AI, 5/6
- `executive-override`: Executive Override, Corp, 6/5
- `street-fixer`: Street Fixer, Merc, 2/2
- `tech-fixer`: Tech Fixer, Merc/Hacker, 3/3
- `military-fixer`: Military Fixer, Military/Merc, 3/2
- `chrome-broker`: Chrome Broker, Bio/Merc, 2/1
- `backchannel-contact`: Backchannel Contact, Merc/Hacker, 2/3
- `clean-operator`: Clean Operator, Merc, 3/4
- `procurement-bot`: Procurement Bot, Drone/Tech, 1/1
- `dead-drop`: Dead Drop, Tech, 3/1
- `talent-scout`: Talent Scout, Corp/Merc, 4/5
- `network-queen`: Network Queen, Merc/Hacker, 5/7
- `nano-swarm`: Nano Swarm, AI/Tech, 1/1
- `signal-booster`: Signal Booster, AI/Tech, 2/1
- `adaptive-shell`: Adaptive Shell, Tech/Bio, 2/2
- `maintenance-cloud`: Maintenance Cloud, AI/Drone, 3/2
- `ai-overseer`: AI Overseer, AI, 3/3
- `replication-node`: Replication Node, AI/Tech, 4/3
- `smart-matter-armor`: Smart Matter Armor, Tech/Bio, 4/5
- `distributed-mind`: Distributed Mind, AI, 5/4
- `grey-goo-bloom`: Grey Goo Bloom, AI/Tech, 5/6
- `citywide-mesh`: Citywide Mesh, AI, 6/5
- `signal-jammer`: Signal Jammer, Hacker/Tech, 2/2
- `black-ice`: Black ICE, AI/Hacker, 3/3
- `trace-hacker`: Trace Hacker, Hacker, 3/4
- `system-crash`: System Crash, Hacker/Tech, 4/3
- `rootkit-kid`: Rootkit Kid, Hacker, 2/1
- `firewall-daemon`: Firewall Daemon, AI/Hacker, 4/4
- `exploit-artist`: Exploit Artist, Hacker/Merc, 5/6
- `null-saint`: Null Saint, Hacker/AI, 6/8
- `black-market-dealer`: Black Market Dealer, Merc, 2/2
- `overclock-chip`: Overclock Chip, Tech, 1/0
- `borrowed-gun`: Borrowed Gun, Tech/Military, 1/3
- `illegal-clone`: Illegal Clone, Bio, 2/2
- `knockoff-cyberarm`: Knockoff Cyberarm, Bio/Tech, 3/5
- `grey-market-cache`: Grey Market Cache, Tech, 3/2
- `debt-collector`: Debt Collector, Corp/Merc, 4/6
- `ghost-vendor`: Ghost Vendor, Hacker/Merc, 4/4
- `hot-merchandise`: Hot Merchandise, Tech, 5/9
- `kingpin-broker`: Kingpin Broker, Merc/Corp, 6/7
- `battery-monk`: Battery Monk, Bio, 1/2
- `capacitor-drone`: Capacitor Drone, Drone/Tech, 2/2
- `quiet-protocol`: Quiet Protocol, AI/Hacker, 2/0
- `stored-charge`: Stored Charge, Tech, 3/3
- `ambush-runner`: Ambush Runner, Merc, 3/4
- `silent-engine`: Silent Engine, AI/Tech, 4/5
- `delayed-payload`: Delayed Payload, Tech/Military, 5/7
- `neon-singularity`: Neon Singularity, AI/Tech, 6/6
- `street-kid`: Street Kid, Merc, 1/2
- `drone-pup`: Drone Pup, Drone, 1/1
- `gang-lookout`: Gang Lookout, Merc, 1/1
- `drone-printer`: Drone Printer, Drone/Tech, 2/1
- `block-party`: Block Party, Merc, 2/2
- `pack-tactics`: Pack Tactics, Military/Merc, 3/2
- `signal-rally`: Signal Rally, AI, 3/3
- `crowd-surge`: Crowd Surge, Merc, 4/4
- `gutter-legion`: Gutter Legion, Merc, 5/5
- `hive-riot`: Hive Riot, Drone/AI, 6/4
- `neon-courier`: Neon Courier, Merc, 2/3
- `getaway-driver`: Getaway Driver, Merc, 3/4
- `rooftop-runner`: Rooftop Runner, Merc/Bio, 3/3
- `traffic-spoofer`: Traffic Spoofer, Hacker/Tech, 4/5
- `escape-route`: Escape Route, Tech, 5/6
- `chrome-surgeon`: Chrome Surgeon, Bio, 2/2
- `reflex-booster`: Reflex Booster, Bio/Tech, 2/1
- `adrenal-graft`: Adrenal Graft, Bio, 3/3
- `wetware-saint`: Wetware Saint, Bio/AI, 4/5
- `illegal-implant`: Illegal Implant, Bio/Tech, 5/8
- `camera-rat`: Camera Rat, Hacker/Drone, 1/2
- `blackmail-file`: Blackmail File, Hacker/Corp, 2/2
- `predictive-cop`: Predictive Cop, AI/Military, 3/3
- `panopticon-ai`: Panopticon AI, AI/Hacker, 5/5
- `junk-packet`: Junk Packet, Hacker/Tech, 1/1
- `deck-worm`: Deck Worm, Hacker/AI, 2/2
- `data-leech`: Data Leech, Hacker, 3/3
- `corruption-bloom`: Corruption Bloom, AI/Hacker, 4/4
- `memory-burner`: Memory Burner, Hacker, 2/4
- `backup-ghost`: Backup Ghost, AI, 3/3
- `street-samurai`: Street Samurai, Merc, 2/4
- `armored-van`: Armored Van, Military/Tech, 3/5
- `night-market-scout`: Night Market Scout, Merc, 1/1
- `metro-enforcer`: Metro Enforcer, Military, 4/7
- `cheap-drone`: Cheap Drone, Drone, 1/1
- `loaded-suit`: Loaded Suit, Corp, 5/8
- `union-rep`: Union Rep, Corp/Merc, 2/2
- `white-hat-auditor`: White-Hat Auditor, Hacker/Corp, 3/3
- `emp-grenade`: EMP Grenade, Military/Tech, 3/2
- `kill-switch`: Kill Switch, Hacker/Tech, 4/4
- `hard-reset`: Hard Reset, AI/Hacker, 5/5
- `junk-card`: Junk, none, 1/0

## Provider And Key Links

Use the UI to link users to:

- OpenAI API keys: https://platform.openai.com/api-keys
- OpenAI image generation docs: https://platform.openai.com/docs/guides/image-generation
- Leonardo API quickstart: https://docs.leonardo.ai/docs/getting-started
- Leonardo web app API access: https://app.leonardo.ai/

Both providers treat API keys as secrets. OpenAI docs say not to expose API keys in browser/client code, and Leonardo's quickstart says to keep keys secure and not embed them client-side. That means the generation call should not run directly from a production browser bundle.

## Solo Local Reality Check

This tool is for one local user only and will not ship. That changes the implementation bar: local key files are acceptable for this workflow as long as it never becomes a public/client-shipped feature.

Recommended default:

- Run it only during local development.
- Keep keys in `documents/keys/open.ai` and `documents/keys/leonardo.ai`, or fallback `.env.local` entries.
- Do not prefix keys with `VITE_` unless intentionally calling providers directly from the browser.
- Prefer a local script/helper for provider calls and file writes because it avoids CORS issues and can write into `public/` cleanly.

Pure browser-only is possible for the review UI, but still awkward for the whole pipeline because:

- Browser code would expose API keys.
- Browser code cannot safely write files into the repo.
- CORS and long-running generation/polling can be annoying provider-by-provider.

Cheapest useful solo compromise:

- Standalone Solid/TanStack UI via `npm run asset-foundry` on `http://localhost:3010` for browsing prompts, reviewing candidates, approving, and promoting.
- Local-only Node/Vite helper endpoints or CLI scripts for generation, file writes, and manifest updates.
- Provider keys are read from local files first-class, with `.env.local` fallback:
  - `documents/keys/open.ai`
  - `documents/keys/leonardo.ai`
  - `OPENAI_API_KEY=...`
  - `LEONARDO_API_KEY=...`

If this ever changes from "me only on my hard drive" to a shipped or shared app, move provider calls behind a real server/serverless function and stop exposing any secrets to browser code.

## MVP Feature Set

1. Asset audit panel
   - Reads active manifest cards and locations.
   - Shows missing, generated, approved, rejected, and added-to-build counts.
   - Filters by asset type: location map, card portrait, card back.

2. Prompt workbench
   - Editable prompt per asset.
   - Shared style guide prompt applied to every asset.
   - Provider selector: `openai` or `leonardo`.
   - Cheap defaults: one candidate per asset, low/standard quality, manual batch size.

3. Batch generation queue
   - Select assets and click `Generate`.
   - Queue writes candidates to `public/art/generated/{provider}/{assetId}/{timestamp}.png`.
   - Store generation metadata in `asset-workbench/state.json`.
   - Save the exact final prompt string used for each generated image, not just the template inputs.

4. Approval queue
   - Review image next to card/location metadata.
   - Buttons: approve, reject, retry with edited prompt, open provider docs.
   - Quick keyboard shortcuts: `A` approve, `R` reject, `G` regenerate, `N` next.
   - Approval is per candidate image, not per asset, so multiple candidates can exist and only one is promoted.
   - Rejected candidates stay in the ledger with rejection notes so we can avoid repeating bad prompts.

5. Add to build
   - Approved card portrait copies to `public/art/cards/{defId}/portrait.webp`.
   - Approved card back copies to `public/art/cards/backs/default.webp`.
   - Approved location map either replaces existing `public/art/maps/{Name}.png` or writes a new `.webp` and updates the location manifest path.
   - Card manifest update sets `cosmetic.art.portrait.path` to `/art/cards/{defId}/portrait.webp`.
   - Promotion records the output file path and manifest field touched.

6. Build verification
   - Run `npm run build`.
   - Show which files changed and which manifest entries were updated.

## UI Design

App: standalone Asset Foundry on `http://localhost:3010`

Design goal: feel like a fast solo production board, not an admin CMS. The screen should optimize for quickly seeing what is missing, generating a small batch, comparing candidates, and promoting winners.

Layout:

- Left rail: provider setup, key status, docs links, style preset, batch controls.
- Main grid: assets needing work, grouped by `Locations`, `Card Fronts`, `Card Backs`.
- Right drawer: selected asset metadata, editable prompt, provider settings, generated candidates, approval actions.
- Bottom bar: queue status, estimated selected count, `Generate selected`, `Add approved to build`, `Run build`.

Primary screens/states:

- `Dashboard`: counts for missing, generated, approved, promoted, rejected, and stale/deprecated source art.
- `Asset Grid`: contact-sheet cards grouped by asset type, status, and batch.
- `Prompt Drawer`: exact prompt editor for the selected asset, with style preset and provider controls.
- `Candidate Compare`: side-by-side generated candidates for one asset, with the active prompt visible below each image.
- `Promote Review`: list of approved candidates that will write into engine-facing asset paths.

V1 app shape:

- `/`: dashboard, grid, selected asset drawer, candidate compare, and promote actions.

Later route shape if deep-linking becomes useful:

- `/$assetId`: selected asset drawer state.
- `/batch/$batchId`: generated batch review.

Asset tile contents:

- Thumbnail or placeholder.
- Asset name and defId.
- Required output spec, e.g. `card-front 640x896`.
- Engine target path.
- Status stamp: `missing`, `generated`, `approved`, `promoted`, `rejected`.
- Last provider/model used.
- Small prompt hash or timestamp so repeated generations are traceable.

Right drawer actions:

- `Generate`: creates one candidate from the current prompt.
- `Generate 3`: optional comparison burst when a card matters.
- `Approve`: marks the selected candidate as the winner for this asset.
- `Reject`: keeps the candidate and prompt in history with optional notes.
- `Promote`: writes approved bitmap to the engine-facing path.
- `Open in Game`: routes to a preview/play screen once promoted.

Keyboard shortcuts:

- `G`: generate selected asset.
- `A`: approve focused candidate.
- `R`: reject focused candidate.
- `P`: promote approved candidate.
- `N` / `J`: next asset.
- `K`: previous asset.

Visual system:

- Contact-sheet grid on a dark print-shop table.
- Big stamped labels for statuses.
- Provider setup as a compact "Keys & Credits" card in the left rail.
- Prompt editor uses a plain textarea with monospace text and visible final prompt preview.
- Generated candidates should show the exact output dimensions and whether normalization passed.

TanStack usage:

- The game app does not import or route to the asset builder.
- Standalone entry lives under `tools/asset-foundry`.
- TanStack Query: `useQuery` for asset audit and candidate state, `useMutation` for generate/approve/promote/build.
- Keep helper endpoints local-only through the Asset Foundry Vite config, exposed only during `npm run asset-foundry`.

Implemented local API endpoints:

- `GET /api/assets/state`: read tooling-only approval ledger.
- `POST /api/assets/generate`: call selected provider and write raw candidate under `public/art/generated/...`.
- `POST /api/assets/normalize`: save browser-canvas-normalized WebP at the exact runtime dimensions.
- `POST /api/assets/status`: approve, reject, or otherwise update candidate state.
- `POST /api/assets/promote`: copy the approved normalized image into its build path and update hard-coded TS manifest paths when needed.

Suggested visual language:

- Treat this as a "print shop / evidence board" rather than a generic admin table.
- Big contact-sheet thumbnails, hard status stamps, and a compact prompt editor.
- Provider links live in a "Keys & Credits" card so setup friction is visible but not noisy.

## Prompt Design

Global style prompt:

```text
Cruel Deal is a cyberpunk tactical card game. Art direction: neon-noir, grimy corporate dystopia, scavenged tech, wet streets, holographic signage, sharp silhouettes, cinematic lighting, readable composition at small card size. Avoid text, logos, watermarks, UI, borders, frames, captions, and realistic copyrighted characters. Make the image feel collectible and game-ready.
```

Card portrait prompt template:

```text
Create a portrait-format card illustration for "{name}".
Faction/tribe: {tribes}.
Gameplay identity: cost {cost}, power {power}, rarity {frame}.
Rules inspiration: {rulesText}.
Flavor inspiration: {flavorText}.
Accent color cue: {accent}.
Composition: single clear subject, centered silhouette, dramatic foreground read, simple background shapes, no card frame, no text.
Output target: 5:7 portrait card art. Final committed runtime bitmap will be 640x896, both dimensions divisible by 8. Optional source/master bitmap can be 1024x1432.
```

Location map prompt template:

```text
Create a tall lane/location illustration for "{name}" in Cruel Deal.
Gameplay mood: {description}.
Accent color cue: {accent}.
Composition: environmental scene, strong vertical lane read, atmospheric depth, clear focal architecture or landmark, no characters dominating the image, no text. The image should cover one full play lane behind enemy slots, the location strip, and player slots.
Output target: 4:15 portrait lane art. Final committed bitmap will be 384x1440, both dimensions divisible by 8. Low-memory fallback is 320x1200.
```

Card back prompt:

```text
Create a premium card back for Cruel Deal, a cyberpunk tactical card game. Symmetrical design, neon circuitry, black chrome, subtle corporate-danger motif, collectible physical card feel, strong center emblem, readable at tiny size. No readable text, no logos, no watermark, no card front frame. Output target: 5:7 portrait card back. Final committed runtime bitmap will be 640x896, both dimensions divisible by 8. Optional source/master bitmap can be 1024x1432.
```

## Approval Ledger

The pipeline should treat generated images as immutable candidates. Every candidate gets a metadata record before it appears in the approval queue.

Suggested record shape:

```ts
export type AssetKind = 'card-front' | 'card-back' | 'location-lane';
export type CandidateStatus = 'generated' | 'approved' | 'rejected' | 'promoted';

export interface AssetCandidateRecord {
  id: string;
  assetKind: AssetKind;
  assetId: string;
  displayName: string;
  provider: 'openai' | 'leonardo';
  providerModel: string;
  providerRequestId?: string;
  generatedAt: string;
  status: CandidateStatus;
  promptTemplateId: string;
  promptTemplateVersion: number;
  promptInputs: Record<string, string | number | string[] | null>;
  finalPrompt: string;
  negativePrompt?: string;
  requestedSize: { w: number; h: number };
  providerOutputSize?: { w: number; h: number };
  committedSize: { w: number; h: number };
  aspectRatio: '5:7' | '4:15';
  dimensionsDivisibleBy8: true;
  rawPath: string;
  normalizedPath: string;
  promotedPath?: string;
  manifestPath?: string;
  reviewerNotes?: string;
}
```

Store the ledger in `asset-workbench/state.json` because it is tooling state, not game runtime state. Generated candidate files can live under `public/art/generated/` so the Solid approval UI can render them directly.

None of this ledger is imported by the game engine. The engine consumes only promoted file paths.

Approval flow:

1. `Generate` creates a candidate record with `status: generated`, `finalPrompt`, raw provider output path, and normalized preview path.
2. `Approve` marks exactly one candidate as approved for that asset. If another candidate for the same asset was already approved, demote the old one back to `generated`.
3. `Reject` keeps the image and prompt in history with optional reviewer notes.
4. `Promote` copies the approved normalized image to the build path, updates the manifest or CSS target, and marks the candidate as `promoted`.
5. `Regenerate from this` clones the previous prompt/settings into a new editable prompt so iteration keeps provenance.

## First Batch Recommendation

Do not generate all 117 images immediately. Start with one proof batch:

- 3 card fronts: `scrap-rat`, `black-ice`, `neon-singularity`
- 2 locations: `hackers-lair`, `alien-starship`
- 1 card back: `default`

This gives coverage across gritty character, abstract hacker/AI, high-rarity spectacle, environment, sci-fi location, and reusable back. Once the look is approved, batch the rest in groups of 10 to keep cost and review fatigue under control.

## Implementation Sequence

1. Add `scripts/assets/audit.ts` to emit cards, locations, missing paths, and default prompts.
2. Add local state file `asset-workbench/state.json` for candidate records and approvals.
3. Add provider adapters:
   - `scripts/assets/providers/openai.ts`
   - `scripts/assets/providers/leonardo.ts`
4. Add local generation CLI:
   - `npm run assets:generate -- --ids scrap-rat black-ice --provider openai`
5. Add promotion CLI:
   - `npm run assets:promote -- --approved`
6. Add standalone Solid Asset Foundry UI on top of the same audit/state/promote commands.
7. Wire card portrait paths into `cyberpunk-cards.ts` during promotion.
8. Add optional CSS usage for `public/art/cards/backs/default.webp` in face-down card styles.

## Cheap Defaults

- Generate one candidate first, not four.
- Use `.webp` for committed build assets.
- Keep raw provider PNGs in `public/art/generated/` only until approved, then clean or archive.
- Prefer OpenAI for prompt adherence and Leonardo for style exploration if credits are cheaper for the account.
- Avoid automated upscaling until a candidate is approved.
