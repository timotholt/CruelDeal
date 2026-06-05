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
- fixed UI copy and fallback labels
- action ids such as `viewContract`
- content binding names such as `mission.body`
- content render mode such as `plain`, `rich`, or `auto`
- action binding names such as `mission.viewTarget`

CMS content owns:

- mission-specific copy
- localized strings, including template-approved CTA labels
- badges, sector labels, reward values
- game entity ids and safe action targets
- content version/provenance

The CMS never sends functions, HTML, CSS, or executable action names outside the
client allowlist.

CMS strings may use the approved material rich-text markup grammar already used
by the editor, e.g. `[body]`, `[h1]`, `[h2]`, `[h3]`, `[h4]`, `[acc1]`,
`[acc2]`, `[RULE]`, and `[DIVIDER]`.
The UI template must opt a binding into rich rendering via `contentMode:
"rich"` or `"auto"`; otherwise CMS text is rendered literally.

Buttons and CTAs are structural UI template nodes, not rich-text tags. The CMS
may provide a button label and destination through bindings such as
`contentBinding` and `action.targetBinding`, but it should not create a CTA by
embedding button markup in body copy.

## Theme / Global Defaults

The theme block is host-owned, validated, and separate from CMS content. It
defines approved global defaults for a template family:

- base text font
- rich text tag tones/sizes/weights
- default material skin id
- spacing scale

`validateUiNodeTheme()` currently accepts a `richText` map whose entries define
`body`, `h1`-`h4`, `acc1`-`acc4`, `rule`, and `divider` styles. `/ui-node`
then turns those styles into the same material rich-text CSS variables used by
the preview renderer. The important rule is the same: CMS supplies content and
safe targets; the client/template owns fonts, colors, embossing, and styling.

The current editor export is useful source material, especially its renderer
settings, but it is not the final wire contract. The editor should migrate
toward this three-document shape:

- UI template JSON: `UiNodePayload`, validated by `validateUiNode()`
- CMS content JSON: copy and safe target values, resolved by host bindings
- Theme defaults JSON: `UiNodeTheme`, validated by `validateUiNodeTheme()`

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
      "id": "mission-copy",
      "type": "text",
      "contentBinding": "mission.briefing",
      "contentMode": "rich"
    },
    {
      "id": "mission-cta",
      "type": "button",
      "contentBinding": "mission.ctaLabel",
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
  "mission.ctaLabel": "View Contract",
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
