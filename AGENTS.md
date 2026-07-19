# CruelDeal Repository Guidance

## Compatibility policy

CruelDeal has no backward-compatibility requirement during active development.
When replacing an architecture, remove the superseded types, state shapes,
fallback reads, aliases, adapters, and dual-write paths. Prefer one clean
canonical implementation over preserving compatibility with old fixtures,
replays, saved state, or internal APIs. Migrate current callers and tests to the
new design instead.
