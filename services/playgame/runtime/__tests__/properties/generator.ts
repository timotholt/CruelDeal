import {
  BOOTSTRAP_MANIFEST,
  apply,
  createInitialMatchState,
  createRng,
  resolve,
  type Deck,
  type LaneIdx,
  type Manifest,
  type MatchEvent,
  type MatchIntent,
  type MatchState,
  type Owner,
  type Rng,
} from '../../../engine';
import { buildOpeningTransaction } from '../../opening';

export interface GeneratedMatchCase {
  readonly generatorSeed: string;
  readonly matchSeed: string;
  readonly decks: Readonly<Record<Owner, Deck>>;
  readonly intents: readonly MatchIntent[];
}

export interface OpenedMatch {
  readonly genesis: MatchState;
  readonly openingEvents: readonly MatchEvent[];
  readonly state: MatchState;
}

const OWNERS = ['P0', 'P1'] as const;
const LANES = [0, 1, 2] as const satisfies readonly LaneIdx[];

function applyAll(
  state: MatchState,
  events: readonly MatchEvent[],
  manifest: Manifest,
): MatchState {
  return events.reduce((current, event) => apply(current, event, manifest), state);
}

function randomSeed(rng: Rng): string {
  return Array.from({ length: 4 }, () =>
    rng.int(0, 0x7fffffff).toString(16).padStart(8, '0'),
  ).join('-');
}

function freezeDeck(defIds: readonly string[]): Deck {
  return Object.freeze(
    defIds.map((defId) => Object.freeze({ defId })),
  );
}

function generateDeck(rng: Rng, manifest: Manifest): Deck {
  const disabled = new Set(manifest.disabled.cards);
  const enabledDefIds = Object.keys(manifest.cards).filter((defId) => !disabled.has(defId));
  if (enabledDefIds.length < manifest.constants.deckSize) {
    throw new Error(
      `property generator needs at least ${manifest.constants.deckSize} enabled cards; found ${enabledDefIds.length}`,
    );
  }
  return freezeDeck(rng.shuffle(enabledDefIds).slice(0, manifest.constants.deckSize));
}

export function assertManifestValidDeck(deck: Deck, manifest: Manifest): void {
  if (deck.length !== manifest.constants.deckSize) {
    throw new Error(`expected a ${manifest.constants.deckSize}-card deck; received ${deck.length}`);
  }
  const disabled = new Set(manifest.disabled.cards);
  const seen = new Set<string>();
  for (const entry of deck) {
    if (!manifest.cards[entry.defId]) {
      throw new Error(`deck references unknown card definition ${entry.defId}`);
    }
    if (disabled.has(entry.defId)) {
      throw new Error(`deck references disabled card definition ${entry.defId}`);
    }
    if (seen.has(entry.defId)) {
      throw new Error(`generated deck contains duplicate card definition ${entry.defId}`);
    }
    seen.add(entry.defId);
  }
}

export function createOpenedMatch(
  input: Pick<GeneratedMatchCase, 'matchSeed' | 'decks'>,
  manifest: Manifest = BOOTSTRAP_MANIFEST,
): OpenedMatch {
  const genesis = createInitialMatchState(input.matchSeed, manifest, input.decks);
  const openingEvents = buildOpeningTransaction(genesis, manifest).events;
  const state = applyAll(genesis, openingEvents, manifest);

  return { genesis, openingEvents, state };
}

export function intentRng(matchSeed: string, intentIndex: number, intentType: MatchIntent['type']): Rng {
  return createRng(matchSeed).fork(`property-intent:${intentIndex}:${intentType}`);
}

function isAccepted(events: readonly MatchEvent[]): boolean {
  return events.length > 0 && events[0].type !== 'INTENT_REJECTED';
}

function acceptedStageIntents(
  state: MatchState,
  owner: Owner,
  intentIndex: number,
  matchSeed: string,
  manifest: Manifest,
): MatchIntent[] {
  const candidates: MatchIntent[] = [];
  for (const card of state.hand[owner]) {
    for (const lane of LANES) {
      const intent: MatchIntent = {
        type: 'STAGE_CARD',
        intentId: `property-${intentIndex}-${owner}-${card.id}-${lane}`,
        owner,
        cardId: card.id,
        lane,
      };
      const events = resolve(
        state,
        intent,
        intentRng(matchSeed, intentIndex, intent.type),
        manifest,
      );
      if (isAccepted(events)) candidates.push(intent);
    }
  }
  return candidates;
}

function acceptedUnstageIntents(
  state: MatchState,
  owner: Owner,
  intentIndex: number,
  matchSeed: string,
  manifest: Manifest,
): MatchIntent[] {
  const candidates: MatchIntent[] = [];
  for (const cardId of state.stagingOrder) {
    if (state.cards[cardId]?.owner !== owner) continue;
    const intent: MatchIntent = {
      type: 'UNSTAGE_CARD',
      intentId: `property-${intentIndex}-${owner}-unstage-${cardId}`,
      owner,
      cardId,
    };
    const events = resolve(
      state,
      intent,
      intentRng(matchSeed, intentIndex, intent.type),
      manifest,
    );
    if (isAccepted(events)) candidates.push(intent);
  }
  return candidates;
}

function chooseLegalAction(
  state: MatchState,
  owner: Owner,
  intentIndex: number,
  matchSeed: string,
  rng: Rng,
  manifest: Manifest,
): MatchIntent | null {
  const stages = acceptedStageIntents(state, owner, intentIndex, matchSeed, manifest);
  const unstages = acceptedUnstageIntents(state, owner, intentIndex, matchSeed, manifest);
  const hasStagedCard = state.stagingOrder.some((cardId) => state.cards[cardId]?.owner === owner);
  const undo: MatchIntent | null = hasStagedCard
    ? {
        type: 'UNDO_TURN',
        intentId: `property-${intentIndex}-${owner}-undo`,
        owner,
      }
    : null;

  const actionKinds = [
    ...(stages.length > 0 ? ['STAGE', 'STAGE', 'STAGE'] as const : []),
    ...(unstages.length > 0 ? ['UNSTAGE'] as const : []),
    ...(undo ? ['UNDO'] as const : []),
  ];
  if (actionKinds.length === 0) return null;

  const action = rng.pick(actionKinds);
  if (action === 'STAGE') return rng.pick(stages);
  if (action === 'UNSTAGE') return rng.pick(unstages);
  return undo;
}

export function generateMatchCase(
  generatorSeed: string,
  manifest: Manifest = BOOTSTRAP_MANIFEST,
): GeneratedMatchCase {
  const generatorRng = createRng(generatorSeed);
  const decks = Object.freeze({
    P0: generateDeck(generatorRng.fork('deck:P0'), manifest),
    P1: generateDeck(generatorRng.fork('deck:P1'), manifest),
  });
  assertManifestValidDeck(decks.P0, manifest);
  assertManifestValidDeck(decks.P1, manifest);

  const matchSeed = randomSeed(generatorRng.fork('match-seed'));
  let state = createOpenedMatch({ matchSeed, decks }, manifest).state;
  const intents: MatchIntent[] = [];
  const decisions = generatorRng.fork('intent-decisions');
  const safetyTurnLimit = manifest.constants.turnLimit + 2;

  while (state.result === null && state.phase !== 'ENDED' && state.turn <= safetyTurnLimit) {
    const ownerOrder = decisions.shuffle(OWNERS);
    for (const owner of ownerOrder) {
      const actionCount = decisions.int(0, 4);
      for (let action = 0; action < actionCount; action++) {
        const intentIndex = intents.length;
        const intent = chooseLegalAction(
          state,
          owner,
          intentIndex,
          matchSeed,
          decisions,
          manifest,
        );
        if (!intent) break;
        const events = resolve(
          state,
          intent,
          intentRng(matchSeed, intentIndex, intent.type),
          manifest,
        );
        if (!isAccepted(events)) {
          throw new Error(`generator selected rejected ${intent.type} intent ${intent.intentId}`);
        }
        intents.push(Object.freeze(intent));
        state = applyAll(state, events, manifest);
      }
    }

    const intentIndex = intents.length;
    const endTurn: MatchIntent = Object.freeze({
      type: 'END_TURN',
      intentId: `property-${intentIndex}-end-turn-${state.turn}`,
      owner: state.priority,
    });
    const endEvents = resolve(
      state,
      endTurn,
      intentRng(matchSeed, intentIndex, endTurn.type),
      manifest,
    );
    if (!isAccepted(endEvents)) {
      throw new Error(`generator selected rejected END_TURN intent ${endTurn.intentId}`);
    }
    intents.push(endTurn);
    state = applyAll(state, endEvents, manifest);
  }

  if (state.result === null || state.phase !== 'ENDED') {
    throw new Error(
      `generated intent sequence did not complete match (turn=${state.turn}, phase=${state.phase})`,
    );
  }

  return Object.freeze({
    generatorSeed,
    matchSeed,
    decks,
    intents: Object.freeze(intents),
  });
}
