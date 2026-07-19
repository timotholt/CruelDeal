import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string): string => readFileSync(
  new URL(relativePath, import.meta.url),
  'utf8',
);

describe('Phase 1.21 presentation architecture fences', () => {
  it('adopts immutable match snapshots by identity instead of deep-cloning them into a store', () => {
    const context = source('../../../contexts/PlayGameContext.tsx');
    expect(context).toContain('createSignal<EngineMatchState>');
    expect(context).toContain('setPresentedState(() => state)');
    expect(context).not.toContain('structuredClone(');
    expect(context).not.toContain('createStore<PresentedStateStore>');
  });

  it('does not install a second board-sizing authority on canonical /play', () => {
    const classicPlay = source('../ClassicPlayScreen.tsx');
    const css = source('../../../src/styles/playgame.css');
    expect(classicPlay).not.toContain('BoardSizer');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr)');
  });

  it('renders stable vertical LaneColumn ownership instead of three sibling lane rows', () => {
    const playBoard = source('./PlayBoard.tsx');
    expect(playBoard).toContain('<LaneColumn');
    expect(playBoard).not.toContain('setupLaneMaps');
    expect(playBoard).not.toContain('enemy-row');
    expect(playBoard).not.toContain('player-row');
  });

  it('conceals setup topology behind typed playfield events and reveals all lanes together', () => {
    const classicPlay = source('../ClassicPlayScreen.tsx');
    const playBoard = source('./PlayBoard.tsx');
    const flows = source('../../../services/playgame/script/flows.ts');
    const css = source('../../../src/styles/playgame.css');

    expect(classicPlay).toContain('class="playgame-root playfield-hidden"');
    expect(playBoard).toContain('createPlayfieldEventPresenter(playRoot)');
    expect(flows).toContain("presentPlayfieldEvent({ type: 'HIDE_PLAYFIELD' })");
    expect(flows).toContain("presentPlayfieldEvent({ type: 'SHOW_PLAYFIELD' })");
    expect(flows).not.toContain('fadeInLocationTile');
    expect(css).toContain('.playgame-root.playfield-hidden .board > .board-game-area');
    expect(css).toContain('transition: opacity 2000ms ease');
  });

  it('keeps opponent telemetry in one fixed header row with visible zone anchors', () => {
    const playBoard = source('./PlayBoard.tsx');
    const css = source('../../../src/styles/playgame.css');
    expect(playBoard).toContain('match-hud__opponent-resources');
    expect(playBoard).not.toContain('match-hud__identity-row');
    expect(playBoard).not.toContain('match-hud__resource-row');
    expect(playBoard).toContain('anchorRef={bindZoneRef(`${remoteSeat}:hand`)}');
    expect(playBoard).toContain('anchorRef={bindZoneRef(`${remoteSeat}:deck`)}');
    expect(playBoard).not.toContain('hand-anchor--remote');
    expect(playBoard).not.toContain('deck-anchor--remote');
    const matchHudRule = css.match(/\.play-frame > \.match-hud\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
    expect(matchHudRule).toContain('grid-template-columns: var(--match-hud-control) minmax(0, 1fr) var(--match-hud-control)');
    expect(matchHudRule).toContain('grid-template-rows: var(--match-hud-control)');
    expect(matchHudRule).toContain('justify-content: stretch');
    const resources = playBoard.match(/<div class="match-hud__opponent-resources"[\s\S]*?<\/div>\n\s*<\/header>/)?.[0] ?? '';
    expect(resources.indexOf('match-hud__resource--deck')).toBeLessThan(resources.indexOf('match-hud__resource--hand'));
    expect(resources.indexOf('match-hud__resource--hand')).toBeLessThan(resources.indexOf('match-hud__resource--energy'));
    expect(css).toContain('grid-template-columns: repeat(3, 62px)');
    expect(css).toContain('min-width: 44px');
  });

  it('orders the player footer as retreat, turn, deck, undo-energy, end turn', () => {
    const playBoard = source('./PlayBoard.tsx');
    expect(playBoard).toContain('count={localDeckSize()}');
    expect(playBoard).toContain('label="Your deck"');
    expect(playBoard).toContain('bindZoneRef(`${localSeat}:deck`)(element)');
    expect(playBoard).not.toContain('class="deck-anchor"');
    const actionBar = playBoard.match(/<div class="action-bar">([\s\S]*?)<\/div>\n\s*<\/footer>/)?.[1] ?? '';
    expect(actionBar.indexOf('retreat-btn')).toBeLessThan(actionBar.indexOf('<TurnOrb'));
    expect(actionBar.indexOf('<TurnOrb')).toBeLessThan(actionBar.indexOf('<MiniDeckIndicator'));
    expect(actionBar.indexOf('<MiniDeckIndicator')).toBeLessThan(actionBar.indexOf('energy-button'));
    expect(actionBar.indexOf('energy-button')).toBeLessThan(actionBar.indexOf('end-turn'));
    expect(actionBar).toContain('`CLOSE (${recordedOutcomeLabel()})`');
    expect(playBoard).toContain("result.winner === remoteSeat ? 'LOSE'");
    expect(playBoard).toContain("recordedOutcomeLabel() === 'LOSE'");
    expect(actionBar).not.toContain('RETREAT (');
  });

  it('uses one control height for portraits, hand backs, and deck backs', () => {
    const css = source('../../../src/styles/playgame.css');
    expect(css).toContain('--play-control-size: 30px');
    expect(css).toContain('--match-hud-control: var(--play-control-size)');
    expect(css).toMatch(/\.match-hud \.hidden-hand__back\s*\{[\s\S]*?height: var\(--play-control-size\)/);
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
    const handRule = [...css.matchAll(/\.hand\s*\{([\s\S]*?)\n\s*\}/g)]
      .map((match) => match[1])
      .find((rule) => rule.includes('display: flex')) ?? '';
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
    for (const cardSource of [handCard, boardCard]) {
      expect(cardSource).not.toContain('draggable=');
      expect(cardSource).not.toContain('onDragStart');
      expect(cardSource).not.toContain('onDragEnd');
      expect(cardSource).toContain('data-drag-source');
    }
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
