/**
 * Old ↔ New state translators for the Step 8a bridge.
 *
 * The /play UI still owns an "old" MatchState shape (flat hand / lanes /
 * enemyLanes arrays, per-card `power` / `cost` fields). The engine owns
 * a richer CardInstance-by-id record. This module contains one-way
 * translators + a name→defId mapping so the bridge can keep the two
 * worlds in lockstep without rewriting either side.
 *
 * @migrate:step-8c — Once the UI consumes engine state directly (Step 8c),
 * this whole file becomes dead code. Keep it small and self-contained.
 */

import type {
  CardInstance as OldCardInstance,
  MatchState as OldMatchState,
} from '../../types';
import type {
  CardInstance as EngineCardInstance,
  MatchState as EngineMatchState,
} from '../types/state';
import type { CardId, Owner } from '../types/ids';
import type { Manifest } from '../manifest/types';

/**
 * Map an old-style card NAME ("HEX WITCH") to the engine's defId
 * ("hex-witch"). The 10 launch cards are named consistently enough that
 * a lowercase-hyphen transform works for all of them.
 *
 * @migrate:step-8c Delete when UI stops referencing old CardDef.name.
 */
export function nameToDefId(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

/** Mirror translation in case anything on the engine side needs to
 *  surface a human name for a legacy UI component. */
export function defIdToName(defId: string, manifest: Manifest): string {
  return manifest.cards[defId]?.name ?? defId;
}

/**
 * Lift a single old CardInstance to an engine CardInstance. Fields the
 * old model doesn't track (spawnSource, powerDelta, tags) get sensible
 * defaults; the id is preserved 1:1 so downstream parity checks can
 * compare by id.
 */
export function liftCard(
  card: OldCardInstance,
  owner: Owner,
  zone: 'HAND' | 'LANE' | 'DECK',
  lane: 0 | 1 | 2 | null,
  manifest: Manifest,
): EngineCardInstance | null {
  const defId = nameToDefId(card.name);
  if (!manifest.cards[defId]) {
    // Unknown-to-engine card (e.g. a card the UI generated from a def
    // that isn't in BOOTSTRAP_MANIFEST). The bridge will log and skip.
    return null;
  }
  return {
    id: card.id as CardId,
    defId,
    version: 1,
    owner,
    lane,
    zone,
    revealed: zone === 'LANE' && !isPending(card),
    powerDelta: 0,
    tags: [],
    textOverride: null,
    counters: {},
    spawnSource: { kind: 'DECK_CREATION' },
  };
}

/** Old state doesn't carry a "revealed" flag per card — it maintains a
 *  top-level `pending: string[]` list of face-down ids. This helper
 *  doesn't have access to that list; pass it in from the caller. */
function isPending(_card: OldCardInstance): boolean {
  return false; // default; lift() caller overrides via parameter
}

/**
 * Build a fresh engine state from an old state. Intentionally lossy —
 * locations are dropped (the 10-card launch manifest doesn't know about
 * the old 10 locations; they get revisited in 8b/8c), and the engine
 * starts with an empty deck because the old UI tracks the draw queue
 * in script context, not in state.
 *
 * Returns null if ANY card in hand/lane can't be translated (unknown
 * defId) — the bridge treats this as "parity unavailable this session"
 * and silently disables the shadow runner. Better than lying.
 */
export function liftMatchState(
  old: OldMatchState,
  manifest: Manifest,
  seed: string,
): EngineMatchState | null {
  const cards: Record<CardId, EngineCardInstance> = {};

  const pending = new Set(old.pending);

  // Player hand
  const handP: EngineCardInstance[] = [];
  for (const c of old.hand) {
    const lifted = liftCard(c, 'PLAYER', 'HAND', null, manifest);
    if (!lifted) return null;
    cards[lifted.id] = lifted;
    handP.push(lifted);
  }

  // Lanes (both sides)
  const laneState: EngineMatchState['lanes'] = [
    { idx: 0, location: null, locationRevealed: false, cards: { PLAYER: [], OPP: [] } },
    { idx: 1, location: null, locationRevealed: false, cards: { PLAYER: [], OPP: [] } },
    { idx: 2, location: null, locationRevealed: false, cards: { PLAYER: [], OPP: [] } },
  ];

  for (let i = 0; i < 3; i++) {
    for (const c of old.lanes[i]) {
      const lifted = liftCard(c, 'PLAYER', 'LANE', i as 0 | 1 | 2, manifest);
      if (!lifted) return null;
      // Face-down while pending; face-up once revealed.
      const withReveal = { ...lifted, revealed: !pending.has(c.id) };
      cards[lifted.id] = withReveal;
      (laneState[i].cards.PLAYER as CardId[]).push(lifted.id);
    }
    for (const c of old.enemyLanes[i]) {
      const lifted = liftCard(c, 'OPP', 'LANE', i as 0 | 1 | 2, manifest);
      if (!lifted) return null;
      const withReveal = { ...lifted, revealed: !pending.has(c.id) };
      cards[lifted.id] = withReveal;
      (laneState[i].cards.OPP as CardId[]).push(lifted.id);
    }
  }

  return {
    turn: old.turn,
    maxEnergy: old.energyMax,
    phase: old.resolving ? 'RESOLVING' : 'AWAITING_INTENT',
    seed,
    priority: old.playerHasPriority ? 'PLAYER' : 'OPP',
    energy: { PLAYER: old.energy, OPP: old.energy },
    deck: { PLAYER: [], OPP: [] },
    hand: { PLAYER: handP, OPP: [] },
    cards,
    lanes: laneState,
    pending: old.pending as CardId[],
    stagingOrder: old.playedThisTurn as CardId[],
    pendingEffects: [],
    log: [],
    lastPlayedBy: { PLAYER: null, OPP: null },
    result: null,
  };
}
