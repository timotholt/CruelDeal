# CMS Live-Ops Backend Gap

Last Updated: 2026-06-08
Status: Technical debt / product architecture note

## Problem

Cruel Deal has a substantial in-app CMS/template/runtime foundation, but it does not yet have the database-backed operational CMS needed to manage live-ops workflows.

The missing layer is not another renderer. The missing layer is the source-of-truth CMS/admin backend for campaigns, scheduling, review state, release bundles, and publish history.

## What Already Exists

- `components/ui/material-lab/uiNodeValidate.ts` defines the safe server-driven `UiNodePayload` contract.
- `components/ui/material-node/MaterialNodeTypes.ts` defines the richer internal material node/tree model.
- `components/screens/UiNodePreviewScreen.tsx` proves template JSON + CMS content bindings + rich theme rendering.
- `components/ui/game-ui/*` defines game UI theme, CMS content, placement schemas, fixtures, diagnostics, runtime assembly, shell components, promo slots, and proof components.
- `components/screens/GameUiSkinProofScreen.tsx` proves theme + CMS content + placements in a runtime screen.
- `services/api/cmsService.ts` currently returns local mock CMS data.

## What Is Missing

- Real CMS database tables/collections.
- Admin UI for live-ops workflows.
- Calendar and campaign planning.
- Task/status workflow.
- Draft/review/approved/scheduled/live states.
- Release bundle validation.
- Publish/unpublish history.
- A generated published live config bundle for the game client.

## Recommended Direction

Use the existing template/runtime contracts as the game-facing layer, and add a database-backed CMS behind them.

Suggested stack:

- Supabase Postgres as the data store.
- Directus as the admin CMS UI on top of Postgres.
- Existing Cruel Deal validators/renderers as the runtime contract.
- A publish step that generates a validated JSON/config bundle for the game.

## Candidate Data Model

Core workflow tables:

- `cms_campaigns`
- `cms_tasks`
- `cms_release_bundles`
- `cms_release_bundle_items`
- `cms_publish_history`

Template/runtime tables:

- `cms_templates`
- `cms_content_bindings`
- `cms_themes`
- `cms_placements`
- `cms_assets`

Game live-ops tables:

- `cms_season_passes`
- `cms_reward_tracks`
- `cms_reward_track_tiers`
- `cms_news_posts`
- `cms_shop_offers`
- `cms_ota_patches`
- `cms_holiday_events`

## Key Boundary

Draft/admin CMS data can be relational, workflow-heavy, and messy.

Published game data must be clean, validated, versioned, and safe:

```text
CMS database
  -> validation/publish pipeline
  -> published live config bundle
  -> Cruel Deal client runtime
```

The game should not consume arbitrary draft CMS rows directly.

## Why This Matters

Monthly season passes, biweekly OTA patches, holiday shop specials, news blurbs, reward tracks, and promo placements will become overwhelming if they remain isolated knobs.

The operational unit should be a `campaign` or `release_bundle`, not a random pile of content edits.

## Next Action

Design the minimal Directus/Supabase schema for:

1. Campaigns
2. Tasks
3. Templates
4. Content bindings
5. Placements
6. Release bundles

Then prove one path:

```text
Create campaign -> assign template/content/placement -> validate -> publish JSON -> render in existing runtime
```
