/**
 * DEBUG ONLY — remove before production.
 *
 * Builds a MatchState from explicit defId lists instead of the random
 * pool picks used by createInitialMatchState(). Mirrors the structure
 * of services/playgame/engine/cli/initState.ts exactly.
 */

import type { MatchState, CardInstance, LaneState, LocationInstance } from '../engine/types/state';
import { EMPTY_TRACKED_VARIABLES } from '../engine/types/state';
import type { Manifest } from '../engine/manifest/types';
import type { CardId, LaneIdx, LocationId, Owner } from '../engine/types/ids';
import { createRng, type Rng } from '../engine/rng';

function mintId(rng: Rng, tag: string): string {
  const sub = rng.fork(tag);
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[sub.int(0, alphabet.length - 1)];
  return out;
}

function buildDeckFromDefIds(
  owner: Owner,
  defIds: readonly string[],
  manifest: Manifest,
  rng: Rng,
): CardInstance[] {
  const deck: CardInstance[] = [];
  for (let i = 0; i < defIds.length; i++) {
    const defId = defIds[i];
    const def = manifest.cards[defId];
    if (!def) {
      console.warn(`[debug] buildDebugState: defId "${defId}" not in manifest — skipped`);
      continue;
    }
    deck.push({
      id: mintId(rng, `${owner}:card:${i}`) as CardId,
      defId: def.defId,
      version: def.version,
      owner,
      lane: null,
      zone: 'DECK',
      revealed: false,
      powerDelta: 0,
      costDelta: 0,
      powerLog: [],
      costLog: [],
      tags: [],
      textOverride: null,
      counters: {},
      spawnSource: { kind: 'DECK_CREATION' },
    });
  }
  return rng.shuffle(deck);
}

/** Weighted random location picks — identical to initState.ts */
function pickLaneLocations(manifest: Manifest, rng: Rng): (LocationInstance | null)[] {
  const disabled = new Set(manifest.disabled.locations);
  const defs = Object.values(manifest.locations).filter(d => d.rarity > 0 && !disabled.has(d.defId));
  if (defs.length < 3) return [null, null, null];

  const remaining = defs.slice();
  const picked: typeof defs = [];

  for (let i = 0; i < 3 && remaining.length > 0; i++) {
    const scale = 1000;
    const scaledTotal = Math.floor(remaining.reduce((s, d) => s + d.rarity, 0) * scale);
    const roll = rng.int(0, Math.max(0, scaledTotal - 1));
    let acc = 0;
    let chosenIdx = remaining.length - 1;
    for (let j = 0; j < remaining.length; j++) {
      acc += Math.floor(remaining[j].rarity * scale);
      if (roll < acc) { chosenIdx = j; break; }
    }
    picked.push(remaining[chosenIdx]);
    remaining.splice(chosenIdx, 1);
  }

  return picked.map((def, laneIdx): LocationInstance => ({
    id: `${def.defId}@${laneIdx}` as LocationId,
    defId: def.defId,
    lane: laneIdx as LaneIdx,
    tags: [],
  }));
}

/**
 * Build a MatchState from explicit player/opponent defId lists.
 * Same structure as createInitialMatchState — same seed → same locations and
 * shuffle order, different deck composition.
 */
export function buildDebugMatchState(
  playerDefIds: readonly string[],
  oppDefIds: readonly string[],
  manifest: Manifest,
  seed: string,
): MatchState {
  const rng = createRng(seed);
  const deckRng = rng.fork('deck');
  const playerDeck = buildDeckFromDefIds('P0', playerDefIds, manifest, deckRng.fork('P0'));
  const oppDeck = buildDeckFromDefIds('P1', oppDefIds, manifest, deckRng.fork('P1'));

  const cards: Record<string, CardInstance> = {};
  for (const c of playerDeck) cards[c.id] = c;
  for (const c of oppDeck) cards[c.id] = c;

  const locs = pickLaneLocations(manifest, rng.fork('locations'));
  const lanes = [0, 1, 2].map(i => ({
    idx: i as LaneIdx,
    location: locs[i] ?? null,
    locationRevealed: false,
    cards: { P0: [] as CardId[], P1: [] as CardId[] },
  })) as unknown as readonly [LaneState, LaneState, LaneState];

  const startEnergy = manifest.constants.energyCurve[0] ?? 1;
  const priority: Owner = rng.fork('priority').int(0, 1) === 0 ? 'P0' : 'P1';

  return {
    turn: 1,
    maxEnergy: { P0: 1, P1: 1 },
    nextTurnEnergyBonus: { P0: 0, P1: 0 },
    phase: 'AWAITING_INTENT',
    seed,
    priority,
    energy: { P0: startEnergy, P1: startEnergy },
    deck: { P0: playerDeck, P1: oppDeck },
    hand: { P0: [], P1: [] },
    cards: cards as Record<CardId, CardInstance>,
    lanes,
    pending: [],
    stagingOrder: [],
    pendingEffects: [],
    log: [],
    lastPlayedBy: { P0: null, P1: null },
    result: null,
    energyLog: { P0: [], P1: [] },
    trackedVariables: EMPTY_TRACKED_VARIABLES,
  };
}
