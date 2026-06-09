# AI-Managed Ops Stack

Status: architecture proposal
Last Updated: 2026-06-08
Scope: Cruel Deal / Cruel Company production operations, CMS live-ops, deployments, secrets, monitoring, and AI-assisted automation.

## Goal

Build an operations stack that is simple, robust, cheap, and safe for AI-assisted management.

The goal is not to let an AI freely administer production infrastructure. The goal is to design the stack so AI can safely observe, diagnose, propose, update, and automate within explicit boundaries.

The system should feel like an OpenClaw-style automation layer for the Cruel Company domain:

- It knows what services exist.
- It knows current health, cost, deploy state, and live-ops state.
- It can explain what matters today.
- It can prepare changes.
- It can run low-risk automations.
- It asks for approval before dangerous actions.
- It never stores raw secrets in chat or in the ops dashboard.

## Core Principle

Do not make AI manage a fragile raw server.

Prefer managed platforms and API-driven services, then let AI operate through:

```text
read-only APIs
Git pull requests
database migrations
provider dashboards
limited-scope automation tokens
human approval gates
auditable logs
```

Avoid:

```text
unrestricted SSH
raw root credentials
manual package upgrades on production
direct production database edits from chat
secrets pasted into prompts
AI-controlled destructive actions without approval
```

## Recommended Stack

### Public App Runtime

Primary choice:

- Netlify for TanStack Start.

Alternate choices:

- Vercel for TanStack Start.
- Fly.io if an always-on Node/container runtime is required.

Purpose:

- SSR.
- Server functions.
- Server routes.
- Middleware.
- Static asset delivery.
- Preview deployments.
- Environment variable management.

Why this is AI-manageable:

- Git push or pull request triggers deployment.
- Deploy history is visible.
- Rollbacks are available through UI/API.
- Environment variables are managed by platform controls.
- AI can inspect deploy logs without owning the server.

### Database, Auth, Storage, Vectors

Primary choice:

- Supabase Pro.

Purpose:

- Postgres database.
- Auth.
- Storage buckets.
- pgvector for embeddings.
- Edge functions where useful.
- Backups and operational dashboard.

Why this is AI-manageable:

- Schema changes can be represented as migrations.
- AI can write migration drafts.
- AI can inspect schema and query read-only views.
- Production writes can be routed through explicit server functions.
- The database is managed by Supabase, not by a hand-maintained VPS.

### DNS, CDN, Protection

Primary choice:

- Cloudflare.

Purpose:

- DNS.
- CDN.
- TLS.
- WAF/basic protection.
- Caching for published live config.
- Rate limiting where needed.

Why this is AI-manageable:

- Rules are API-addressable.
- DNS state is inspectable.
- Cache rules can be versioned/documented.
- Changes should still require approval.

### CMS Admin

Primary choice:

- Directus connected to Supabase Postgres.

Hosting options:

- Fly.io.
- Render.
- Railway.
- Hetzner/Vultr VPS only if ops maturity improves.

Purpose:

- CMS data editing.
- Campaign records.
- Calendar workflows.
- Live-ops messages.
- Release bundles.
- Templates, placements, and theme records.

Important boundary:

Directus is the authoring dashboard. It is not the player runtime.

Player runtime should consume validated published config:

```text
Directus draft data
  -> validation / publish pipeline
  -> versioned live config JSON
  -> Cruel Deal client
```

If Directus goes down, the game should continue using the last published config.

### Monitoring And Incident Awareness

Recommended baseline:

- Sentry for frontend/server errors.
- UptimeRobot or Better Stack for uptime checks.
- Provider dashboards for Netlify/Vercel/Fly/Supabase.
- Custom `/ops` dashboard for Cruel Company-specific status.

Optional later:

- Grafana Cloud for deeper metrics/logs.
- Better Stack logs/incident management if a single monitoring suite becomes worth paying for.

Purpose:

- Uptime.
- Error rate.
- Slow endpoints.
- Failed deploys.
- Failed background jobs.
- Cost spikes.
- Live config publish failures.

Why this is AI-manageable:

- AI can summarize events.
- AI can compare incidents with recent deploys.
- AI can draft remediation steps.
- AI can suggest rollback candidates.

### Secrets

Primary choice:

- Bitwarden or 1Password for human secrets.

Optional developer secrets platform:

- Infisical.
- Doppler.
- 1Password Secrets Automation.

Rules:

- The ops dashboard must not store raw secrets.
- Chat sessions must not receive raw secrets.
- Store metadata only:

```text
secret name
provider
environment
owner
last rotated date
where used
vault item link/reference
rotation runbook
```

Example:

```text
SUPABASE_SERVICE_ROLE_KEY
- stored in: Bitwarden
- environment: production
- used by: TanStack Start, Directus publish worker
- last rotated: 2026-06-01
- rotation interval: 90 days
- emergency action: rotate in Supabase, update Netlify/Fly env vars, redeploy
```

## Custom Cruel Company Ops Dashboard

Create a private admin route:

```text
/ops
```

Suggested sections:

### Health

- Public site health.
- TanStack Start health endpoint.
- Supabase status.
- Directus status.
- Current deployment.
- Current live config version.
- Last successful publish.
- Last successful backup check.

### Costs

- Supabase projected monthly spend.
- Netlify/Vercel/Fly/Render spend.
- AI/API spend.
- Storage usage.
- Bandwidth usage.
- Alerts when spend exceeds budget thresholds.

### Live-Ops

- Current season.
- Active campaigns.
- Active messages.
- Scheduled OTA.
- Current shop specials.
- Upcoming publish jobs.
- Failed validations.
- Campaigns blocked by missing assets/tasks.

### Security

- Secrets inventory metadata.
- Secrets due for rotation.
- Admin accounts.
- 2FA checklist.
- Webhook signing status.
- Last restore test.
- Dangerous permissions audit.

### Incidents

- Active incidents.
- Recent uptime failures.
- Recent Sentry issues.
- Recent deploys.
- Failed jobs.
- Rollback links.
- Relevant runbooks.

### AI Daily Brief

Every morning, generate:

```text
Production: healthy/degraded/down
Monthly projected spend: $X
New errors: N
Failed jobs: N
Next live-ops release: date/name
Secrets due for rotation: N
Human attention needed:
1. ...
2. ...
3. ...
```

## AI Access Model

Use permission tiers.

### Tier 0: Public Knowledge

AI can read:

- Public docs.
- Architecture notes.
- Runbooks.
- Non-secret service inventory.

Allowed actions:

- Explain system.
- Draft plans.
- Draft checklists.

### Tier 1: Read-Only Ops

AI can read:

- Deploy logs.
- Uptime monitor results.
- Sentry issue summaries.
- Supabase schema metadata.
- Cost summaries.
- Live config versions.

Allowed actions:

- Summarize health.
- Detect anomalies.
- Draft incident report.
- Suggest likely cause.

### Tier 2: Safe Write Through Git

AI can write:

- Code changes.
- Config changes.
- Migration drafts.
- Runbook updates.
- CMS schema proposals.

Allowed actions:

- Open pull request.
- Run tests.
- Prepare migration.
- Request approval.

Not allowed:

- Direct production mutation.
- Direct secret rotation.
- Direct destructive database changes.

### Tier 3: Approved Automation

AI can perform limited actions only after explicit approval:

- Trigger deploy.
- Roll back to previous deploy.
- Run approved migration.
- Purge CDN cache.
- Pause a scheduled CMS publish.
- Re-run a failed publish job.

All actions must be logged.

### Tier 4: Emergency Break-Glass

Reserved for human owner.

Examples:

- Root/server access.
- Payment provider keys.
- Supabase service role rotation.
- Production database restore.
- DNS nameserver changes.
- Deleting production resources.

AI may provide step-by-step guidance, but should not hold the credentials.

## GitOps Workflow

Most changes should flow through Git.

```text
AI observes issue
  -> AI proposes fix
  -> AI edits code/config/migration
  -> tests run
  -> human reviews
  -> merge/deploy
  -> AI monitors result
```

This is safer than direct production editing because:

- Changes are reviewed.
- History is preserved.
- Rollback is clear.
- CI can catch mistakes.
- AI actions are visible.

## Database Change Workflow

Supabase schema changes should use migrations.

```text
AI drafts migration
  -> migration runs on local/staging
  -> tests validate assumptions
  -> human approves
  -> migration runs on production
  -> schema snapshot updates
```

Rules:

- Avoid destructive migrations without backups.
- Add nullable columns before required columns.
- Backfill separately when needed.
- Keep irreversible operations human-approved.
- Always document rollback plan.

## Publish Workflow For Live-Ops

The CMS should not directly change player-facing runtime state.

Use a publish pipeline:

```text
CMS draft records
  -> validate campaign completeness
  -> validate assets
  -> validate audience rules
  -> validate placement conflicts
  -> generate live config
  -> write versioned bundle
  -> update current pointer
  -> CDN cache refresh
```

The client reads:

```text
/live-config/current.json
```

or:

```text
/live-config/2026-07-01.3.json
```

This makes the game resilient if CMS authoring tools are down.

## Minimum Production Service Inventory

Create a machine-readable inventory file:

```yaml
services:
  web:
    provider: netlify
    url: https://crueldeal.example.com
    health_url: https://crueldeal.example.com/health
    criticality: high

  database:
    provider: supabase
    project: crueldeal-prod
    criticality: critical

  cms:
    provider: fly.io
    app: crueldeal-directus
    health_url: https://cms.crueldeal.example.com/server/health
    criticality: medium

  monitoring:
    provider: sentry
    criticality: medium
```

Store it in:

```text
ops/services.yaml
```

## Minimum Runbooks

Create these before launch:

- `site-down.md`
- `database-down.md`
- `bad-deploy-rollback.md`
- `supabase-key-rotation.md`
- `stripe-webhook-failure.md`
- `cms-publish-failed.md`
- `restore-from-backup.md`
- `cost-spike.md`
- `asset-cdn-failure.md`

Each runbook should include:

```text
symptoms
dashboards to check
likely causes
safe first actions
dangerous actions
rollback path
who/what owns credentials
```

## Recommended First Implementation

Phase 1:

- Netlify for TanStack Start.
- Supabase Pro for Postgres/auth/storage/pgvector.
- Cloudflare for DNS/CDN.
- Bitwarden for secrets.
- Sentry for error tracking.
- UptimeRobot or Better Stack for uptime.
- A private `/ops` route that shows static service inventory and health check results.

Phase 2:

- Add Directus connected to Supabase.
- Add CMS campaign/release tables.
- Add published live config bundles.
- Add AI daily brief.
- Add cost metadata and budget thresholds.

Phase 3:

- Add provider API integrations.
- Add AI incident summaries.
- Add approved automation actions.
- Add staged database migration workflow.
- Add secret rotation reminders.

## What AI Should Be Allowed To Do First

Start with read-only and Git-based actions:

- Read logs and errors.
- Summarize uptime.
- Summarize costs.
- Draft code fixes.
- Draft Supabase migrations.
- Draft Directus schema changes.
- Draft runbooks.
- Update docs.
- Open pull requests.

Only later allow controlled write actions:

- Trigger deploy.
- Roll back deploy.
- Purge cache.
- Re-run publish job.
- Disable a scheduled campaign.

## What AI Should Not Own

AI should not be the only holder of:

- Supabase service role key.
- Payment provider secret keys.
- Domain registrar access.
- Cloudflare account owner credentials.
- Bitwarden/1Password master password.
- Production database restore permissions.
- Root SSH keys.

AI can help you use these safely, but should not be the vault.

## Final Shape

The target is a small, AI-assisted production cockpit:

```text
Cruel Company Ops
  -> health
  -> costs
  -> live-ops
  -> deploys
  -> incidents
  -> security posture
  -> runbooks
  -> AI daily brief
  -> approved actions
```

The stack should make the safe path easy:

```text
observe
diagnose
propose
review
deploy
verify
document
```

And make the dangerous path deliberately hard:

```text
direct prod mutation
secret exposure
unreviewed destructive action
unlogged emergency access
```

This is the version of AI-managed operations that fits a solo indie developer: not magic, not reckless, but a calm control plane that keeps the lights on without requiring a full infrastructure team.
