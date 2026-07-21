import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string): string =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('Phase 1.21 presentation architecture fences', () => {
  it('adopts immutable match snapshots by identity instead of deep-cloning them into a store', () => {
    const matchContext = source('../../../contexts/MatchSessionContext.tsx');
    const uiContext = source('../../../contexts/PlayUiContext.tsx');
    expect(matchContext).toContain('createSignal(initialization.setup');
    expect(uiContext).toContain('setPresentedState(() =>');
    expect(matchContext).not.toContain('structuredClone(');
    expect(uiContext).not.toContain('structuredClone(');
    expect(uiContext).not.toContain('createStore<PresentedStateStore>');
  });

  it('does not install a second board-sizing authority on canonical /play', () => {
    const classicPlay = source('../ClassicPlayScreen.tsx');
    const cityMap = source('../CityMapScreen.tsx');
    const tensorPlay = source('../TensorPlayScreen.tsx');
    const css = source('../../../src/styles/playgame.css');
    const appViewportCss = source('../../../src/styles/app-viewport.css');
    expect(classicPlay).not.toContain('BoardSizer');
    expect(existsSync(new URL('./BoardSizer.tsx', import.meta.url))).toBe(false);
    expect(classicPlay).not.toContain("style={{ width: '100%', height: '100%'");
    expect(cityMap).not.toContain("style={{ width: '100%', height: '100%'");
    expect(tensorPlay).not.toContain("style={{ width: '100%', height: '100%'");
    const rootRule = css.match(/:root\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
    const playRootRule = css.match(/\.playgame-root\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
    const playFrameRule = css.match(/\.board\.play-frame\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
    expect(rootRule).not.toContain('--board-w');
    expect(rootRule).not.toContain('--lane-gap');
    expect(playRootRule).toContain('--board-w: 100cqw');
    expect(playRootRule).toContain('--board-h: 100cqh');
    expect(playFrameRule).not.toContain('--board-w');
    expect(playFrameRule).not.toContain('--board-h');
    expect(appViewportCss).toContain('--app-frame-w: min(100dvw, calc(100dvh * 9 / 16)');
    expect(appViewportCss).toContain('--app-frame-h: calc(var(--app-frame-w) * 16 / 9)');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr)');
  });

  it('renders stable vertical LaneColumn ownership instead of three sibling lane rows', () => {
    const playBoard = source('./PlayBoard.tsx');
    const laneGrid = source('./LaneGrid.tsx');
    expect(playBoard).toContain('<LaneGrid');
    expect(laneGrid).toContain('<For each={props.laneIds}>');
    expect(laneGrid).toContain('<LaneColumn');
    expect(laneGrid).not.toContain('setupLaneMaps');
    expect(laneGrid).not.toContain('enemy-row');
    expect(laneGrid).not.toContain('player-row');
  });

  it('renders lane maps declaratively and binds animation elements by ref', () => {
    const playBoard = source('./PlayBoard.tsx');
    const laneGrid = source('./LaneGrid.tsx');
    const laneColumn = source('./LaneColumn.tsx');
    const laneMap = source('./LaneMap.tsx');
    const sink = source('../../../services/playgame/presentation/playPresentationSink.ts');
    expect(laneColumn).toContain('<LaneMap');
    expect(laneColumn).not.toContain("'background-image'");
    expect(laneMap).toContain("'background-image': props.location.mapArt");
    expect(laneGrid).toContain('mapRef={props.bindMapRef(laneId)}');
    expect(playBoard).toContain('useLanePresentationRefs()');
    expect(playBoard).not.toContain('querySelector<HTMLElement>(\n          `.lane-map');
    expect(playBoard).not.toContain('querySelector<HTMLElement>(\n          `.location');
    expect(sink).not.toContain('mapElement.style.backgroundImage');
    expect(sink).not.toContain('getLocationTemplate');
    expect(laneMap).not.toContain('Math.random');
    expect(laneMap).not.toContain('shuffle');
  });

  it('conceals setup topology behind typed playfield events and reveals all lanes together', () => {
    const classicPlay = source('../ClassicPlayScreen.tsx');
    const playBoard = source('./PlayBoard.tsx');
    const opening = source('../../../services/playgame/presentation/openingPresentation.ts');
    const css = source('../../../src/styles/playgame.css');

    expect(classicPlay).toContain('class="playgame-root playfield-hidden"');
    expect(playBoard).toContain('startOpeningPresentation({');
    expect(opening).toContain('createPlayfieldEventPresenter(options.root)');
    expect(opening).toContain("presentPlayfieldEvent({ type: 'HIDE_PLAYFIELD' })");
    expect(opening).toContain("presentPlayfieldEvent({ type: 'SHOW_PLAYFIELD' })");
    expect(playBoard).not.toContain('fadeInLocationTile');
    expect(css).toContain('.playgame-root.playfield-hidden .board > .board-game-area');
    expect(css).toContain('transition: opacity 2000ms ease');
  });

  it('keeps opening on one committed frame walk and derives terminal copy from presented state', () => {
    const playBoard = source('./PlayBoard.tsx');
    const opening = source('../../../services/playgame/presentation/openingPresentation.ts');
    const uiContext = source('../../../contexts/PlayUiContext.tsx');

    expect(playBoard).toContain('presentOpening: uiActions.presentOpening');
    expect(playBoard).toContain('bindPresentationSink: uiActions.bindPresentationSink');
    expect(opening).toContain('options.presentOpening(options.timeline)');
    expect(opening).toContain('options.bindPresentationSink(options.sink)');
    expect(uiContext).toContain('await director.present(timeline, sink)');
    expect(uiContext).not.toContain('for (const frame of timeline.frames)');
    expect(playBoard).not.toContain('createScript');
    expect(playBoard).not.toContain('resolveTurnFlow');
    expect(playBoard).toContain('presentedState().turn');
    expect(playBoard).not.toContain('Turn 6');
  });

  it('keeps animation implementations out of the PlayBoard composition root', () => {
    const playBoard = source('./PlayBoard.tsx');
    const opening = source('../../../services/playgame/presentation/openingPresentation.ts');
    const handPresentation = source('../../../services/playgame/presentation/handPresentation.ts');

    expect(playBoard).toContain('startOpeningPresentation({');
    expect(playBoard).toContain('prepareHandLayoutTransition(allIds, cardRefs)');
    expect(playBoard).not.toContain("from '@/services/vfx/animations/");
    expect(playBoard).not.toContain('createPlayfieldEventPresenter(');
    expect(playBoard).not.toContain('setTimeout(');
    expect(playBoard).not.toContain('requestAnimationFrame(');
    expect(opening).toContain("'HIDE_PLAYFIELD'");
    expect(opening).toContain("'SHOW_PLAYFIELD'");
    expect(handPresentation).toContain('captureCardRects(cardIds, cardRefs)');
    expect(handPresentation).toContain('playCardLayoutSlide(oldRects, cardRefs)');
  });

  it('composes the stable header and action bar instead of owning their markup', () => {
    const playBoard = source('./PlayBoard.tsx');
    const viewModel = source('./usePlayBoardViewModel.ts');
    expect(playBoard).toContain('<MatchHud');
    expect(playBoard).toContain('<MatchActionBar');
    expect(playBoard).toContain('<LaneGrid');
    expect(playBoard).toContain('<PlayOverlays');
    expect(playBoard).not.toContain('<header class="hud-top opponent-header match-hud">');
    expect(playBoard).not.toContain('<div class="action-bar">');
    expect(playBoard).not.toContain('<div class="lane-track"');
    expect(playBoard).not.toContain('<ReplayDrawer');
    expect(playBoard).not.toContain('<ZoomInspector');
    expect(playBoard).not.toContain('<PileViewer');
    expect(playBoard).toContain('usePlayBoardViewModel({');
    expect(playBoard).not.toContain('getHandForSeat(');
    expect(playBoard).not.toContain('getLaneCardsForSeat(');
    expect(viewModel).toContain('getHandForSeat(');
    expect(viewModel).toContain('getLaneCardsForSeat(');
  });

  it('publishes committed turn blocks to one director-owned presentation queue', () => {
    const matchContext = source('../../../contexts/MatchSessionContext.tsx');
    const uiContext = source('../../../contexts/PlayUiContext.tsx');
    const playBoard = source('./PlayBoard.tsx');

    expect(matchContext).toContain('subscribeCommittedTransactions');
    expect(matchContext).not.toContain('resolutionWaiters');
    expect(uiContext).toContain('const timelineQueue: SeatTransactionTimeline[] = []');
    expect(uiContext).toContain('match.subscribeCommittedTransactions');
    expect(uiContext).toContain('setPresentationBusy(true)');
    expect(uiContext).not.toContain('director.activeGeneration !== null) director.fastForward()');
    expect(playBoard).not.toContain('timeline.frames.forEach');
    expect(playBoard).not.toContain('for (const frame of');
  });

  it('keeps opponent telemetry in one fixed header row with visible zone anchors', () => {
    const playBoard = source('./PlayBoard.tsx');
    const matchHud = source('./MatchHud.tsx');
    const css = source('../../../src/styles/playgame.css');
    expect(playBoard).toContain('<MatchHud');
    expect(matchHud).toContain('match-hud__opponent-resources');
    expect(matchHud).not.toContain('match-hud__identity-row');
    expect(matchHud).not.toContain('match-hud__resource-row');
    expect(matchHud).toContain('anchorRef={props.remoteHandAnchorRef}');
    expect(matchHud).toContain('anchorRef={props.remoteDeckAnchorRef}');
    expect(matchHud).not.toContain('hand-anchor--remote');
    expect(matchHud).not.toContain('deck-anchor--remote');
    const matchHudRule = css.match(/\.play-frame > \.match-hud\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
    expect(matchHudRule).toContain(
      'grid-template-columns: var(--match-hud-control) minmax(0, 1fr) var(--match-hud-control)',
    );
    expect(matchHudRule).toContain('grid-template-rows: var(--match-hud-control)');
    expect(matchHudRule).toContain('justify-content: stretch');
    const resources =
      matchHud.match(
        /<div class="match-hud__opponent-resources"[\s\S]*?<\/div>\n\s*<\/header>/,
      )?.[0] ?? '';
    expect(resources.indexOf('match-hud__resource--deck')).toBeLessThan(
      resources.indexOf('match-hud__resource--hand'),
    );
    expect(resources.indexOf('match-hud__resource--hand')).toBeLessThan(
      resources.indexOf('match-hud__resource--energy'),
    );
    expect(css).toContain('grid-template-columns: repeat(3, 62px)');
    expect(css).toContain('min-width: 44px');
  });

  it('registers single-card opponent transfer anchors instead of aggregate stack bounds', () => {
    const deck = source('./MiniDeckIndicator.tsx');
    const hand = source('./HiddenHandIndicator.tsx');
    const css = source('../../../src/styles/playgame.css');

    expect(deck).toContain('data-card-transfer-anchor="deck"');
    expect(deck).toMatch(
      /ref=\{\(element\) => props\.anchorRef\?\.\(element\)\}[\s\S]*?mini-deck__back--front/,
    );
    expect(hand).toContain('data-card-transfer-anchor="hand"');
    expect(hand).toContain('class="hidden-hand__transfer-anchor"');
    expect(css).toMatch(
      /\.match-hud \.hidden-hand__transfer-anchor\s*\{[\s\S]*?width: 21px;[\s\S]*?height: var\(--play-control-size\)/,
    );
    expect(css).toMatch(
      /\.mini-deck__back\s*\{[\s\S]*?width: 21px;[\s\S]*?height: var\(--play-control-size/,
    );
  });

  it('orders the player footer as retreat, turn, deck, undo-energy, end turn', () => {
    const playBoard = source('./PlayBoard.tsx');
    const matchActionBar = source('./MatchActionBar.tsx');
    const viewModel = source('./usePlayBoardViewModel.ts');
    expect(playBoard).toContain('deckSize={localDeckSize()}');
    expect(matchActionBar).toContain('label="Your deck"');
    expect(playBoard).toContain('deckAnchorRef={bindZoneRef(`${localSeat}:deck`)}');
    expect(matchActionBar).not.toContain('class="deck-anchor"');
    const actionBar = matchActionBar.match(/<div class="action-bar">([\s\S]*?)<\/div>/)?.[1] ?? '';
    expect(actionBar.indexOf('retreat-btn')).toBeLessThan(actionBar.indexOf('<TurnOrb'));
    expect(actionBar.indexOf('<TurnOrb')).toBeLessThan(actionBar.indexOf('<MiniDeckIndicator'));
    expect(actionBar.indexOf('<MiniDeckIndicator')).toBeLessThan(
      actionBar.indexOf('energy-button'),
    );
    expect(actionBar.indexOf('energy-button')).toBeLessThan(actionBar.indexOf('end-turn'));
    expect(actionBar).toContain('`CLOSE (${props.outcomeLabel})`');
    expect(viewModel).toContain("result.winner === options.remoteSeat) return 'LOSE'");
    expect(playBoard).toContain('outcomeLabel={recordedOutcomeLabel()}');
    expect(actionBar).not.toContain('RETREAT (');
  });

  it('uses one control height for portraits, hand backs, and deck backs', () => {
    const css = source('../../../src/styles/playgame.css');
    expect(css).toContain('--play-control-size: 30px');
    expect(css).toContain('--match-hud-control: var(--play-control-size)');
    expect(css).toMatch(
      /\.match-hud \.hidden-hand__back\s*\{[\s\S]*?height: var\(--play-control-size\)/,
    );
    expect(css).toMatch(/\.mini-deck__back\s*\{[\s\S]*?height: var\(--play-control-size, 30px\)/);
  });

  it('moves half of the former location gap to the playfield boundaries', () => {
    const css = source('../../../src/styles/playgame.css');
    expect(css).toContain('--location-gap: 12px');
    expect(css).toContain('--playfield-gutter-y: 12px');
    expect(css).toContain('inset: var(--playfield-gutter-y) 0');
  });

  it('moves spare footer space below the hand and enlarges fixed-size edge-button text', () => {
    const css = source('../../../src/styles/playgame.css');
    const handRule =
      [...css.matchAll(/\.hand\s*\{([\s\S]*?)\n\s*\}/g)]
        .map(match => match[1])
        .find(rule => rule.includes('display: flex')) ?? '';
    const retreatRule = css.match(/\.retreat-btn\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
    const endTurnRule = css.match(/\.end-turn\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
    expect(handRule).toContain('align-items: flex-start');
    expect(handRule).toContain('padding: 0 8px');
    for (const buttonRule of [retreatRule, endTurnRule]) {
      expect(buttonRule).toContain('height: 32px');
      expect(buttonRule).toContain('padding: 4px 6px');
      expect(buttonRule).toContain('font-size: 13px');
    }
  });

  it('keeps top counts tight while giving footer status controls more separation', () => {
    const css = source('../../../src/styles/playgame.css');
    const miniDeckRule = css.match(/\.mini-deck\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
    const miniDeckCountRule = css.match(/\.mini-deck__count\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
    const hudHandRule = css.match(/\.match-hud \.hidden-hand\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
    const actionBarRule = css.match(/\.action-bar\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
    expect(miniDeckRule).toContain('gap: 0');
    expect(miniDeckCountRule).toContain('margin-left: -1px');
    expect(hudHandRule).toContain('gap: 3px');
    expect(actionBarRule).toContain('gap: 16px');
  });

  it('uses one full-surface purple card back without a split gold overlay', () => {
    const css = source('../../../src/styles/playgame.css');
    const facedownRule = css.match(/\.card\.facedown\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
    expect(facedownRule).toContain('repeating-linear-gradient');
    expect(facedownRule).toContain('#1a1f3a');
    expect(facedownRule).toContain('#12172a');
    expect(css).not.toContain('.card.facedown::before');
  });

  it('keeps native HTML drag-and-drop out of canonical card components', () => {
    const handCard = source('./HandCard.tsx');
    const boardCard = source('./BoardCard.tsx');
    const cardFace = source('./CardFace.tsx');
    for (const cardSource of [handCard, boardCard]) {
      expect(cardSource).not.toContain('draggable=');
      expect(cardSource).not.toContain('onDragStart');
      expect(cardSource).not.toContain('onDragEnd');
      expect(cardSource).toContain('data-drag-source');
      expect(cardSource).toContain('vfxRegistry={cardVfxRegistry}');
      expect(cardSource).not.toContain('<CardVfxStack');
      expect(cardSource).not.toContain("class={'cost '");
    }
    expect(cardFace).toContain('registry={props.vfxRegistry}');
    expect(cardFace).not.toContain('data-drag-source');
  });

  it('uses one card-face renderer without changing zone-owned geometry', () => {
    const boardCard = source('./BoardCard.tsx');
    const handCard = source('./HandCard.tsx');
    const pileViewer = source('./PileViewer.tsx');
    const cardFace = source('./CardFace.tsx');
    expect(boardCard).toContain("'card lane-card'");
    expect(handCard).toContain("class={'hand-card-motion'");
    expect(handCard).toContain("class={'card'");
    expect(pileViewer).toContain('<CardFace card={card} variant="pile" />');
    expect(cardFace).toContain("showPower: card.type !== 'spell'");
    expect(cardFace).toContain('class="pile-card"');
    expect(cardFace).toContain('class="portrait"');
  });

  it('scopes card effects to each mounted VFX host', () => {
    const vfxHost = source('../../game/VfxHost.tsx');
    const registry = source('../../../services/vfx/card-effects/registry.ts');
    const presentationHost = source(
      '../../../services/playgame/presentation/playPresentationHost.ts',
    );
    const cardFace = source('./CardFace.tsx');
    const cardVfxStack = source('../../card/CardVfxStack.tsx');

    expect(vfxHost).toContain('const cardVfxRegistry = createCardVfxRegistry()');
    expect(vfxHost).not.toContain('ZoneAnchorKey');
    expect(vfxHost).toContain('zoneRefs: Map<string, HTMLElement>');
    expect(registry).toContain('export const createCardVfxRegistry');
    expect(registry).not.toContain('export const cardVfxRegistry');
    expect(presentationHost).toContain('readonly cardVfxRegistry: CardVfxRegistry');
    expect(presentationHost).toContain('zoneElement(key: ZoneAnchorKey)');
    expect(presentationHost).not.toContain('import { cardVfxRegistry }');
    expect(cardFace).not.toContain('import { cardVfxRegistry }');
    expect(cardVfxStack).not.toContain('import { cardVfxRegistry }');
  });

  it('routes pointer, tap, and keyboard staging through one manifest-sized controller', () => {
    const board = source('./PlayBoard.tsx');
    const interaction = source('./useCardInteraction.ts');

    expect(board).toContain('setupCardInteraction({');
    expect(board).toContain('laneCapacity: manifest.constants.laneCapacity');
    expect(interaction).toContain("boardEl.addEventListener('pointerdown'");
    expect(interaction).toContain("boardEl.addEventListener('click'");
    expect(interaction).toContain("boardEl.addEventListener('keydown'");
    expect(interaction).not.toContain('length >= 4');
    expect(interaction).not.toContain('length < 4');
  });

  it('gives spells a surface-only silhouette inside the canonical card box', () => {
    const boardCard = source('./BoardCard.tsx');
    const handCard = source('./HandCard.tsx');
    const css = source('../../../src/styles/playgame.css');
    expect(boardCard).toContain('data-card-type={props.card.type}');
    expect(handCard).toContain('data-card-type={props.card.type}');
    const spellRule =
      css.match(/\.card\[data-card-type="spell"\]\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
    expect(spellRule).toContain('clip-path: polygon(');
    expect(spellRule).not.toContain('width:');
    expect(spellRule).not.toContain('height:');
    expect(spellRule).not.toContain('transform:');
    expect(spellRule).not.toContain('transition:');
  });

  it('animates lane position without animating lane dimensions', () => {
    const css = source('../../../src/styles/playgame.css');
    const topologyMotion = source('./useLaneTopologyMotion.ts');
    expect(css).toContain('left: calc(var(--lane-center) - (var(--lane-w) / 2))');
    expect(css).toContain('width: var(--lane-w)');
    expect(css).toContain('height: 100%');
    expect(topologyMotion).toContain('lane.style.translate');
    expect(topologyMotion).toContain('transition = `translate');
    const laneColumnRule = css.match(/\.lane-column\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
    expect(laneColumnRule).not.toContain('will-change');
    expect(topologyMotion).not.toContain('lane.style.width');
    expect(topologyMotion).not.toContain('lane.style.height');
  });
});
