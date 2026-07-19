import { describe, expect, it } from 'vitest';

import { apply } from '../../engine/apply';
import { buildDebugMatchState } from '../../debug/buildDebugState';
import {
  createInitialMatchState,
  createSetupMatch,
} from '../../engine/cli/initState';
import { runMatch } from '../../engine/cli/runMatch';
import { replayMatch } from '../../engine/replay';
import { testCardDef, testLocationDef, testManifest } from '../../engine/testkit';
import type { CardDef, Deck, Manifest } from '../../engine/manifest/types';
import type { MatchEvent } from '../../engine/types/events';
import type { MatchBootstrap } from '../contracts';
import { computeDeckContentHash, validateMatchBootstrap } from '../bootstrapValidation';
import { defaultLocationDeckFactory } from '../locationDeckFactory';
import { buildOpeningTransaction } from '../opening';

function manifestFixture(): Manifest {
  const plainVariant = testCardDef('card-0');
  const variantCard: CardDef = {
    ...plainVariant,
    cosmetic: {
      ...plainVariant.cosmetic,
      variants: [{
        variantId: 'holo',
        displayName: 'Holo',
        art: { portrait: { path: '/holo.png' } },
        frame: 'holo',
        source: 'earned',
      }],
    },
  };
  return testManifest(
    [variantCard, ...Array.from({ length: 11 }, (_, index) => testCardDef(`card-${index + 1}`))],
    Array.from({ length: 3 }, (_, index) => testLocationDef(`location-${index}`)),
    { deckSize: 12, startingHandSize: 3, turnStartDraw: 1 },
  );
}

function deckFixture(withVariant = false): Deck {
  return Array.from({ length: 12 }, (_, index) => ({
    defId: `card-${index}`,
    ...(withVariant && index === 0 ? { variantId: 'holo' } : {}),
  }));
}

function bootstrapFixture(manifest: Manifest, p0 = deckFixture(true), p1 = deckFixture()): MatchBootstrap {
  const ruleset = manifest.rulesets.standard;
  if (!ruleset) throw new Error('fixture requires standard ruleset');
  return {
    matchId: 'bootstrap-validation-match',
    mode: 'CONQUEST',
    seed: 'bootstrap-validation-seed',
    rulesetId: 'standard',
    manifestVersion: manifest.version,
    viewerSeat: 'P0',
    participants: {
      P0: { participantId: 'p0', controller: 'LOCAL_HUMAN', displayName: 'P0' },
      P1: { participantId: 'p1', controller: 'LOCAL_AI', displayName: 'P1' },
    },
    decks: {
      P0: {
        kind: 'PLAYER',
        deckId: 'deck-p0',
        revision: 4,
        name: 'P0 Deck',
        entries: p0,
        contentHash: computeDeckContentHash(p0),
      },
      P1: {
        kind: 'PLAYER',
        deckId: 'deck-p1',
        revision: 7,
        name: 'P1 Deck',
        entries: p1,
        contentHash: computeDeckContentHash(p1),
      },
      LOCATIONS: defaultLocationDeckFactory.build({
        manifest,
        ruleset,
        seed: 'bootstrap-validation-seed',
      }),
    },
  };
}

function issueCodes(result: ReturnType<typeof validateMatchBootstrap>): string[] {
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe('validateMatchBootstrap', () => {
  it('accepts, defensively copies, hashes, and deeply freezes a valid bootstrap', () => {
    const manifest = manifestFixture();
    const input = bootstrapFixture(manifest);
    const result = validateMatchBootstrap(input, manifest);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toBe(input);
    expect(result.value.decks.P0.entries).not.toBe(input.decks.P0.entries);
    expect(result.value.decks.P0.contentHash).toBe(
      'sha256:f6ff00306056978e59d633b27de23c453b94d568366b0ea618012f2a94a867d3',
    );
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.participants.P0)).toBe(true);
    expect(Object.isFrozen(result.value.decks.P0)).toBe(true);
    expect(Object.isFrozen(result.value.decks.P0.entries)).toBe(true);
    expect(Object.isFrozen(result.value.decks.P0.entries[0])).toBe(true);
  });

  it('rejects a short deck without silently normalizing it', () => {
    const manifest = manifestFixture();
    const short = deckFixture().slice(0, 11);
    const result = validateMatchBootstrap(bootstrapFixture(manifest, short), manifest);

    expect(issueCodes(result)).toContain('INVALID_DECK_SIZE');
  });

  it('rejects a mismatched manifest version', () => {
    const manifest = manifestFixture();
    const result = validateMatchBootstrap({
      ...bootstrapFixture(manifest),
      manifestVersion: manifest.version + 1,
    }, manifest);

    expect(issueCodes(result)).toContain('MANIFEST_VERSION_MISMATCH');
  });

  it('uses the shared protocol schema as the structural bootstrap boundary', () => {
    const manifest = manifestFixture();
    const result = validateMatchBootstrap({
      ...bootstrapFixture(manifest),
      transportOnlyField: true,
    }, manifest);

    expect(issueCodes(result)).toEqual(['INVALID_BOOTSTRAP_SHAPE']);
    if (!result.ok) {
      expect(result.issues[0].message).toContain('additional properties');
    }
  });

  it('rejects an unknown ruleset', () => {
    const manifest = manifestFixture();
    const result = validateMatchBootstrap({
      ...bootstrapFixture(manifest),
      rulesetId: 'missing-ruleset',
    }, manifest);

    expect(issueCodes(result)).toContain('UNKNOWN_RULESET');
  });

  it('rejects an unknown definition', () => {
    const manifest = manifestFixture();
    const entries = deckFixture().map((entry, index) => index === 5 ? { defId: 'missing-def' } : entry);
    const result = validateMatchBootstrap(bootstrapFixture(manifest, entries), manifest);

    expect(issueCodes(result)).toContain('UNKNOWN_CARD_DEFINITION');
  });

  it('rejects a definition disabled by the manifest', () => {
    const base = manifestFixture();
    const manifest: Manifest = {
      ...base,
      disabled: { ...base.disabled, cards: ['card-5'] },
    };
    const result = validateMatchBootstrap(bootstrapFixture(manifest), manifest);

    expect(issueCodes(result)).toContain('DISABLED_CARD_DEFINITION');
  });

  it('rejects an unknown selected variant', () => {
    const manifest = manifestFixture();
    const entries = deckFixture().map((entry, index) => index === 0
      ? { defId: entry.defId, variantId: 'missing-variant' }
      : entry);
    const result = validateMatchBootstrap(bootstrapFixture(manifest, entries), manifest);

    expect(issueCodes(result)).toContain('UNKNOWN_CARD_VARIANT');
  });

  it('rejects duplicates beyond the manifest-declared copy limit', () => {
    const manifest = manifestFixture();
    const entries = deckFixture().map((entry, index) => index === 11 ? { defId: 'card-0' } : entry);
    const result = validateMatchBootstrap(bootstrapFixture(manifest, entries), manifest);

    expect(issueCodes(result)).toContain('COPY_LIMIT_EXCEEDED');
  });

  it('rejects duplicates of a manifest-declared unique definition', () => {
    const base = manifestFixture();
    const manifest: Manifest = {
      ...base,
      rulesets: {
        standard: {
          ...base.rulesets.standard,
          rulesetId: 'standard',
          deckConstruction: { uniqueCardDefIds: ['card-0'] },
        },
      },
    };
    const entries = deckFixture().map((entry, index) => index === 11 ? { defId: 'card-0' } : entry);
    const result = validateMatchBootstrap(bootstrapFixture(manifest, entries), manifest);

    expect(issueCodes(result)).toContain('UNIQUENESS_RULE_VIOLATION');
  });

  it('does not invent a copy rule when the manifest omits one', () => {
    const base = manifestFixture();
    const manifest: Manifest = {
      ...base,
      rulesets: {
        standard: {
          ...base.rulesets.standard,
          rulesetId: 'standard',
          deckConstruction: {},
        },
      },
    };
    const entries = deckFixture().map((entry, index) => index === 11 ? { defId: 'card-0' } : entry);
    const result = validateMatchBootstrap(bootstrapFixture(manifest, entries), manifest);

    expect(result.ok).toBe(true);
  });

  it('rejects a content hash that does not match the ordered entries', () => {
    const manifest = manifestFixture();
    const bootstrap = bootstrapFixture(manifest);
    const result = validateMatchBootstrap({
      ...bootstrap,
      decks: {
        ...bootstrap.decks,
        P0: { ...bootstrap.decks.P0, contentHash: 'sha256:not-the-deck' },
      },
    }, manifest);

    expect(issueCodes(result)).toContain('CONTENT_HASH_MISMATCH');
  });
});

describe('card variants and opening initialization', () => {
  it('retains a selected variant through genesis, opening draws, and replay', () => {
    const manifest = manifestFixture();
    const decks = { P0: deckFixture(true), P1: deckFixture() } as const;
    const setup = createSetupMatch('variant-genesis-replay', manifest, decks);
    const genesis = setup.genesis;
    const selected = Object.values(genesis.cards).find((card) => card.variantId === 'holo');

    expect(selected).toBeDefined();
    expect(selected?.defId).toBe('card-0');
    const opening = buildOpeningTransaction(setup.state, manifest);
    const finalState = opening.events.reduce(
      (state, event) => apply(state, event, manifest),
      setup.state,
    );
    const replayed = replayMatch({
      seed: genesis.seed,
      manifest,
      initialState: genesis,
      framedEvents: finalState.log.map(({ frame, scope, event }) => ({
        frame,
        scope,
        event: event as MatchEvent,
      })),
    });

    expect(finalState.cards[selected!.id].variantId).toBe('holo');
    expect(replayed.finalState).toEqual(finalState);
    expect(replayed.finalState.cards[selected!.id].variantId).toBe('holo');
  });

  it('builds the same symmetric opening transaction for the same genesis', () => {
    const manifest = manifestFixture();
    const decks = { P0: deckFixture(), P1: deckFixture() } as const;
    const firstGenesis = createInitialMatchState('symmetric-opening', manifest, decks);
    const secondGenesis = createInitialMatchState('symmetric-opening', manifest, decks);
    const first = buildOpeningTransaction(firstGenesis, manifest);
    const second = buildOpeningTransaction(secondGenesis, manifest);

    expect(first).toEqual(second);
    expect(first.events
      .filter((event) => event.type === 'CARD_DRAWN')
      .map((event) => event.owner)).toEqual([
      'P0', 'P0', 'P0', 'P1', 'P1', 'P1', 'P0', 'P1',
    ]);
    const opened = first.events.reduce(
      (state, event) => apply(state, event, manifest),
      firstGenesis,
    );
    const openingHandSize = manifest.constants.startingHandSize + manifest.constants.turnStartDraw;
    expect(opened.hand.P0).toHaveLength(openingHandSize);
    expect(opened.hand.P1).toHaveLength(openingHandSize);
    expect(opened.deck.P0).toHaveLength(manifest.constants.deckSize - openingHandSize);
    expect(opened.deck.P1).toHaveLength(manifest.constants.deckSize - openingHandSize);
  });

  it('makes the headless driver consume the shared 3+1 opening transaction', () => {
    const manifest = manifestFixture();
    const result = runMatch({ seed: 'headless-shared-opening', manifest, maxTurns: 0 });
    const openingHandSize = manifest.constants.startingHandSize + manifest.constants.turnStartDraw;

    expect(result.events.filter((event) => event.type === 'CARD_DRAWN'))
      .toHaveLength(openingHandSize * 2);
    expect(result.finalState.hand.P0).toHaveLength(openingHandSize);
    expect(result.finalState.hand.P1).toHaveLength(openingHandSize);
    expect(result.finalState.deck.P0).toHaveLength(manifest.constants.deckSize - openingHandSize);
    expect(result.finalState.deck.P1).toHaveLength(manifest.constants.deckSize - openingHandSize);
  });

  it('derives the turn-1 start draw count from the manifest', () => {
    const base = manifestFixture();
    const manifest: Manifest = {
      ...base,
      constants: { ...base.constants, turnStartDraw: 2 },
    };
    const genesis = createInitialMatchState(
      'manifest-turn-start-draw',
      manifest,
      { P0: deckFixture(), P1: deckFixture() },
    );
    const opened = buildOpeningTransaction(genesis, manifest).events.reduce(
      (state, event) => apply(state, event, manifest),
      genesis,
    );

    expect(opened.hand.P0).toHaveLength(5);
    expect(opened.hand.P1).toHaveLength(5);
    expect(opened.deck.P0).toHaveLength(7);
    expect(opened.deck.P1).toHaveLength(7);
  });

  it('makes the debug builder fail hard on an unknown definition', () => {
    const manifest = manifestFixture();
    expect(() => buildDebugMatchState(
      [{ defId: 'missing-def' }],
      deckFixture(),
      manifest,
      'debug-hard-error',
    )).toThrow('missing-def');
  });
});
