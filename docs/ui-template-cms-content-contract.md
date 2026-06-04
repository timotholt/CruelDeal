# UI Template And CMS Content Contract

Status: draft
Date: 2026-06-04

## Goal

Separate app-owned UI structure from CMS-authored mission/content data.

The UI template describes trusted interface shape: nodes, skins, layout,
fixed labels, action ids, and binding names. The CMS content document supplies
copy and game-object references for those bindings. The renderer combines them
at runtime through host-owned resolvers.

## Boundary

UI template owns:

- node tree and component type
- layout and surface/material ids
- fixed UI copy such as `View Contract`
- action ids such as `viewContract`
- content binding names such as `mission.body`
- action binding names such as `mission.viewTarget`

CMS content owns:

- mission-specific copy
- localized strings
- badges, sector labels, reward values
- game entity ids and safe action targets
- content version/provenance

The CMS never sends functions, HTML, CSS, or executable action names outside the
client allowlist.

## Example

Template:

```json
{
  "id": "mission-briefing",
  "type": "panel",
  "materialId": "mission-panel",
  "children": [
    { "id": "mission-title", "type": "text", "contentBinding": "mission.title" },
    {
      "id": "mission-cta",
      "type": "button",
      "text": "View Contract",
      "action": {
        "id": "viewContract",
        "targetBinding": "mission.viewTarget"
      }
    }
  ]
}
```

CMS content:

```json
{
  "mission.title": "Data Extraction",
  "mission.viewTarget": { "kind": "contract", "id": "contract_solace_mainframe" }
}
```

## Runtime Rule

`renderUiNodeToSolid(template, context)` resolves bindings. Actions remain
client-owned:

```ts
onAction({ id: 'viewContract', target: { kind: 'contract', id: 'contract_solace_mainframe' } })
```

The game engine decides what `viewContract` means. The CMS only supplies the
safe target data.
