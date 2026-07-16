# Mission Briefing V2 Current Implementation Checkpoint

Status: P0 current-state evidence complete; not the visual target

This directory freezes the current `/main-material` Mission Briefing V2 look
and render inputs before semantic-schema/compiler migration. It is a
preservation checkpoint, not the future runtime format or visual goal. The
user-approved product target is `../mission-v2-target.png`.

## Recorded current-state capture conditions

- fixture: `season-pass-cosmic-eclipse-v2` / `card_type_04` from `fixture.json`;
- browser viewport: 2560 x 1440 CSS px, DPR 1, dark color scheme;
- phone rect: x 1020, y 257.78125, width 520, height 924.4375 CSS px;
- checked-in raster crop: 520 x 924 PNG (fractional bottom edge rounded down);
- selection overlay and emission inspector: hidden;
- animation clock: real time, normal motion;
- hold duration: 1400 ms; complete acknowledgement: 520 ms.

`environment.json` pins the browser, host, toolchain, font candidates, fixture
hash, and visual asset hashes. `dom-summary.json` pins the current selected V2
subtree and observed state classes. `static-implementation-summary.md` records
where the current generic implementation lives and how it behaves.

## Capture meanings

- `idle.png` — stable V2 preview before input;
- `holding.png` — unobscured frame 700 ms after the production button receives
  pointerdown;
- `complete.png` — frame during the 520 ms complete acknowledgement after a
  sustained pointer hold longer than 1400 ms;
- `idle-repeat.png` — returned idle state after completion;
- `editor-context.png` — full editor context used to locate and review V2.

The in-app browser controller masks most page pixels while its physical drag
gesture is actively in progress. For that reason, the unobscured `holding.png`
uses a standard `PointerEvent` dispatched to the rendered semantic button; it
executes the same production SolidJS pointerdown handler without modifying
source or DOM. `complete.png` and the recorded idle -> holding -> complete ->
idle class transition use a sustained physical pointer gesture. This capture
constraint is also recorded in `dom-summary.json`.

## Reproduction procedure

1. Check out the commit and toolchain recorded in `environment.json`.
2. Run `npm run dev -- --host 127.0.0.1`.
3. Open `/main-material` at the recorded viewport and browser profile.
4. Activate `Show feed slide 2`, confirm its `aria-current` becomes `true`, and
   wait until the feed track transform reaches `matrix(1, 0, 0, 1, -520, 0)`.
5. Hide the emission inspector and leave selection overlay mode at `Off`.
6. Crop the observed `.main-material-phone` rect.
7. Capture idle; capture holding before 1400 ms; capture complete after 1400 ms
   and before 1920 ms; then capture returned idle.
8. Confirm the state classes and subtree counts match `dom-summary.json`.

## Current hashes

```text
fixture.json     e2167f9a09f5137db15bdfac28446a6853cedf534cd7bc51483d32ea23761ca2
idle.png         2d286c0017bc864b841f22751195e2178a2de5ec94317a8842e39b9c69644e6f
holding.png      b2f748c2f4b0f46bef221012fb614b78a50efe7dbe0523e71221f1eeea052e94
complete.png     e0b320884aa378058ddc2be15b637c8f83f6a943a335d1746708a1f1e6b6c249
idle-repeat.png  2d286c0017bc864b841f22751195e2178a2de5ec94317a8842e39b9c69644e6f
```

The byte-identical idle and idle-repeat images prove that the current real-time
interaction returns to the captured idle presentation. Dynamic animation
frames are accepted by state/class and visual review rather than by assuming
identical capture timing. These captures cannot close M9; only an approved
runtime comparison against `../mission-v2-target.png` can close the visual gate.
