# App Viewport System

## Theory Of Operations

Cruel Deal is a portrait-first game. The canonical game surface is always a
centered 9:16 frame. Desktop and tablet landscape do not make the game wider;
they reveal optional side capacity.

The viewport is split into three zones:

```txt
browser viewport
└─ app viewport grid
   ├─ left rail  = remaining width
   ├─ center     = required 9:16 game frame
   └─ right rail = remaining width
```

The center frame is the only required interactive surface. Login, menus, store,
deck, play, overlays, and navigation should all fit and work inside it. The left
and right rails are optional companion zones for PC mode: debug tools, social
panels, deck notes, event callouts, livestream-friendly widgets, or atmospheric
art. No required game action may depend on a rail.

The center frame is also the responsive container root. Components should adapt
to the frame using CSS container queries, not browser-width media queries. This
keeps the UI stable whether the same 9:16 frame is shown on a phone, inside a
desktop browser, or inside a future shell.

JavaScript should only measure the frame when pixel math is genuinely needed,
such as play-board card sizing. General layout changes should stay in CSS.

## Implementation Guide

Use `AppViewport` whenever a real game surface is rendered:

```tsx
<AppViewport>
  <Screen />
</AppViewport>
```

The component creates:

- `.app-viewport`: full browser stage.
- `.app-viewport__rail--left`: optional left desktop rail.
- `.app-viewport__frame`: canonical 9:16 center frame and container-query root.
- `.app-viewport__rail--right`: optional right desktop rail.

The CSS contract:

- `--app-frame-w`: computed center frame width.
- `--app-frame-h`: computed center frame height.
- `container-name: game-frame` on the center frame.
- `container-type: size` on the center frame.

Use container queries like:

```css
@container game-frame (max-width: 380px) {
  .nav-label {
    font-size: 9px;
  }
}
```

Side rails can be populated from inside screens with `ViewportRailPortal`:

```tsx
<ViewportRailPortal side="right">
  <MatchStatsPanel />
</ViewportRailPortal>
```

Rails must be additive. If a rail disappears because the device is narrow or the
shell chooses to hide it, the center game remains complete.

## Migration Rules

1. Real app routes render inside `AppViewport`.
2. Lab/tool routes such as `/uitest` and `/login-material` stay outside the
   viewport because their side panels are tools, not game rails.
3. Navigation and normal overlays live inside the center frame.
4. Global dev tools may escape the center frame only when that is intentional.
5. Play-board sizing reads the center frame dimensions, not `window`.
6. New screens use `width: 100%; height: 100%;` against the frame, not the
   browser viewport.
