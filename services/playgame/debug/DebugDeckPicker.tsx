/**
 * DEBUG ONLY — remove before production.
 *
 * Single entry point for the debug deck picker.
 * Renders as a Portal over document.body — mount this anywhere.
 *
 * Usage:
 *   <DebugDeckPicker onConfirm={(playerCards, oppCards) => startGame(...)} />
 *
 * Two-step flow:
 *   Step 1 — pick your deck
 *   Step 2 — pick opponent deck  (or click "Random" to auto-assign)
 */

import { createSignal, For, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { DEBUG_DECKS, type DebugDeck } from './debugDecks';
import type { MatchBootstrap } from '../runtime/contracts';
import { buildDebugMatchBootstrap } from './buildDebugBootstrap';
import {
  DEFAULT_DEBUG_MATCH_SEED,
  normalizeDebugMatchSeed,
  pickDebugOpponent,
} from './debugMatchSetup';

interface Props {
  onConfirm: (bootstrap: MatchBootstrap) => void;
  initialSeed?: string;
}

type Step = 'player' | 'opp';

export const DebugDeckPicker = (props: Props) => {
  const [step, setStep] = createSignal<Step>('player');
  const [playerDeck, setPlayerDeck] = createSignal<DebugDeck | null>(null);
  const [oppDeck, setOppDeck] = createSignal<DebugDeck | null>(null);
  const [seed, setSeed] = createSignal(normalizeDebugMatchSeed(props.initialSeed));
  const [randomDraw, setRandomDraw] = createSignal(0);

  const handleSelect = (deck: DebugDeck) => {
    if (step() === 'player') {
      setPlayerDeck(deck);
      setOppDeck(null);
      setRandomDraw(0);
      setStep('opp');
    } else {
      if (deck.id === playerDeck()?.id) return; // can't pick same deck as opponent
      setOppDeck(deck);
    }
  };

  const pickRandomOpp = () => {
    const player = playerDeck();
    if (!player) return;
    const draw = randomDraw();
    setOppDeck(pickDebugOpponent(DEBUG_DECKS, player.id, seed(), draw));
    setRandomDraw(draw + 1);
  };

  const confirm = () => {
    const p = playerDeck();
    const o = oppDeck();
    if (!p || !o) return;
    props.onConfirm(buildDebugMatchBootstrap(p, o, normalizeDebugMatchSeed(seed())));
  };

  const goBack = () => {
    setStep('player');
    setOppDeck(null);
  };

  return (
    <Portal mount={document.body}>
      <div class="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div class="mb-5 text-center select-none">
          <div class="text-[0.55rem] uppercase tracking-[0.5em] text-white/20 mb-1">
            Debug Build
          </div>
          <div class="text-white font-black text-xl tracking-tight">
            <Show when={step() === 'player'} fallback="Pick Opponent Deck">
              Pick Your Deck
            </Show>
          </div>
          <Show when={step() === 'opp'}>
            <div class="text-white/40 text-xs mt-1">
              You: <span class="font-bold" style={{ color: playerDeck()?.color }}>
                {playerDeck()?.name}
              </span>
              {' — now pick the opponent, or '}
              <button
                class="underline text-white/60 hover:text-white transition-colors"
                onClick={pickRandomOpp}
              >
                randomise
              </button>
            </div>
          </Show>
          <label class="mt-3 grid gap-1 text-left text-[0.55rem] font-bold uppercase tracking-widest text-white/35">
            Match seed
            <input
              class="w-64 rounded border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-xs normal-case tracking-normal text-white/75 outline-none focus:border-white/40"
              value={seed()}
              placeholder={DEFAULT_DEBUG_MATCH_SEED}
              spellcheck={false}
              onInput={(event) => {
                setSeed(event.currentTarget.value);
                setRandomDraw(0);
                setOppDeck(null);
              }}
            />
          </label>
        </div>

        {/* ── Deck grid ───────────────────────────────────────────────── */}
        <div class="grid grid-cols-4 gap-2.5 max-w-3xl w-full">
          <For each={DEBUG_DECKS}>
            {(deck) => {
              const isPlayer = () => playerDeck()?.id === deck.id;
              const isOpp = () => oppDeck()?.id === deck.id;
              const isSelf = () => step() === 'opp' && deck.id === playerDeck()?.id;

              const borderCol = () =>
                isPlayer() ? deck.color
                : isOpp()   ? deck.color
                : 'rgba(255,255,255,0.08)';

              const bgCol = () =>
                isPlayer() || isOpp() ? `${deck.color}18` : 'rgba(255,255,255,0.02)';

              return (
                <button
                  onClick={() => handleSelect(deck)}
                  disabled={isSelf()}
                  class="relative text-left rounded p-3 transition-all duration-150 outline-none focus-visible:ring-1"
                  style={{
                    border: `1px solid ${borderCol()}`,
                    background: bgCol(),
                    opacity: isSelf() ? '0.25' : '1',
                    cursor: isSelf() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {/* YOU / OPP badge */}
                  <Show when={isPlayer() || isOpp()}>
                    <div
                      class="absolute top-1.5 right-1.5 text-[0.45rem] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-sm"
                      style={{ background: deck.color, color: '#000' }}
                    >
                      {isPlayer() ? 'YOU' : 'OPP'}
                    </div>
                  </Show>

                  {/* Archetype label */}
                  <div
                    class="text-[0.5rem] uppercase tracking-widest font-bold mb-1"
                    style={{ color: `${deck.color}cc` }}
                  >
                    {deck.archetype}
                  </div>

                  {/* Deck name */}
                  <div class="text-white font-bold text-sm leading-tight mb-1.5">
                    {deck.name}
                  </div>

                  {/* Game plan blurb */}
                  <div class="text-white/35 text-[0.6rem] leading-snug">
                    {deck.gamePlan}
                  </div>

                  {/* Difficulty */}
                  <div
                    class="mt-2 text-[0.5rem] uppercase tracking-wider"
                    style={{ color: `${deck.color}66` }}
                  >
                    {deck.difficulty}
                  </div>
                </button>
              );
            }}
          </For>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div class="mt-5 flex items-center gap-5">
          <Show when={step() === 'opp'}>
            <button
              class="text-white/25 text-xs hover:text-white/60 transition-colors"
              onClick={goBack}
            >
              ← Back
            </button>
          </Show>

          <button
            onClick={confirm}
            disabled={!playerDeck() || !oppDeck()}
            class="px-8 py-2 rounded font-black uppercase tracking-widest text-sm transition-all"
            style={{
              background: playerDeck() && oppDeck() ? '#ffffff' : 'rgba(255,255,255,0.08)',
              color: playerDeck() && oppDeck() ? '#000000' : 'rgba(255,255,255,0.2)',
              cursor: playerDeck() && oppDeck() ? 'pointer' : 'not-allowed',
            }}
          >
            Start Game
          </button>
        </div>

        <div class="mt-4 text-white/15 text-[0.5rem] uppercase tracking-widest select-none">
          Debug deck picker — not in production builds
        </div>
      </div>
    </Portal>
  );
};
