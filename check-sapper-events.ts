import { BOOTSTRAP_MANIFEST, createInitialMatchState, resolveTurn, apply, createRng, type CardId } from './services/playgame/engine';
import { orderedTestLocationDeck } from './services/playgame/engine/testkit/runtimeFixture';

const DUNE_SAPPER = BOOTSTRAP_MANIFEST.cards['dune-sapper'];
if (!DUNE_SAPPER) throw new Error('Dune Sapper not found in manifest');

const s0 = createInitialMatchState(
  'test-seed',
  BOOTSTRAP_MANIFEST,
  {},
  orderedTestLocationDeck(BOOTSTRAP_MANIFEST),
);
const sapperId = 'sapper1' as CardId;

// Add Sapper to hand and stage it
let s = apply(s0, {
  type: 'CARD_ADDED_TO_HAND',
  owner: 'P0',
  cardId: sapperId,
  defId: DUNE_SAPPER.defId,
  spawnSource: { kind: 'DECK_CREATION' },
}, BOOTSTRAP_MANIFEST);

s = apply(s, {
  type: 'CARD_STAGED',
  intentId: 'i',
  cardId: sapperId,
  lane: 1,
  owner: 'P0',
  cost: 1,
}, BOOTSTRAP_MANIFEST);

// Resolve turn and check events
const res = resolveTurn(s, BOOTSTRAP_MANIFEST, createRng('sapper-test'));

console.log('Event stream:');
for (let i = 0; i < res.events.length; i++) {
  const e = res.events[i];
  if (e.type === 'OR_WINDOW_OPEN') {
    console.log(`  OR Window Open for ${e.cardId}, mult: ${e.multiplier}`);
  }
  const extra = 'cardId' in e ? ` ${e.cardId}` : '';
  const lanes = e.type === 'CARD_MOVED' ? ` ${e.fromLane}→${e.toLane}` : '';
  console.log(`  ${i}: ${e.type}${extra}${lanes}`);
}
