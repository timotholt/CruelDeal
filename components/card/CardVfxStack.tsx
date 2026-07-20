/**
 * CardVfxStack — renders absolute-positioned VFX overlays for one card.
 *
 * Uses a transparent Fragment so existing card layout (grid, absolute badges)
 * is not disturbed. Active VFX records render as position:absolute overlays
 * inside the nearest position:relative ancestor (the .card container).
 *
 * Channel semantics are preserved via CSS class names and z-index, not
 * physical nesting, for this first slice. Full nested-wrapper mode is
 * appropriate when wrapping UnifiedCardView (new card system) in a later
 * slice.
 */

import { createEffect, createSignal, onCleanup, For } from 'solid-js';
import { cardVfxRegistry } from '@/services/vfx/card-effects/registry';
import type { CardTransientVfx } from '@/services/vfx/card-effects/types';
import type { JSX } from 'solid-js';

const CHANNEL_Z: Record<string, number> = {
  'world-motion': 0,
  'impact-shake': 1,
  'interaction-pose': 2,
  'power-pulse': 3,
  'face-transform': 4,
  'surface-fx': 5,
  'persistent-fx': 6,
};

interface CardVfxStackProps {
  cardId: string;
  children: JSX.Element;
}

export function CardVfxStack(props: CardVfxStackProps) {
  const [layers, setLayers] = createSignal(
    cardVfxRegistry.getLayers(''),
  );

  createEffect(() => {
    const cardId = props.cardId;
    setLayers(cardVfxRegistry.getLayers(cardId));
    const unsubscribe = cardVfxRegistry.subscribe(cardId, () => {
      setLayers(cardVfxRegistry.getLayers(cardId));
    });
    onCleanup(() => {
      unsubscribe();
      cardVfxRegistry.clearCard(cardId, 'card-unmounted');
    });
  });

  function handleAnimationEnd(record: CardTransientVfx) {
    cardVfxRegistry.complete(record.id);
  }

  function applyVars(el: HTMLElement, vars: Record<string, string>, zIndex: number) {
    for (const [k, v] of Object.entries(vars)) {
      el.style.setProperty(k, v);
    }
    el.style.setProperty('z-index', String(zIndex));
  }

  return (
    <>
      {props.children}
      <For each={layers().transient}>
        {(rec) => (
          <div
            class={`card-vfx-overlay card-vfx-overlay--${rec.channel} ${rec.className}`}
            ref={(el) => { if (el) applyVars(el, rec.vars, CHANNEL_Z[rec.channel] ?? 5); }}
            onAnimationEnd={() => handleAnimationEnd(rec)}
          />
        )}
      </For>
      <For each={layers().persistent}>
        {(grp) => (
          <div
            class={`card-vfx-overlay card-vfx-overlay--persistent card-fx-${grp.visualKind} ${grp.phase === 'exiting' ? 'card-vfx-overlay--exiting' : ''}`}
            ref={(el) => { if (el) applyVars(el, grp.vars, CHANNEL_Z['persistent-fx'] ?? 6); }}
          />
        )}
      </For>
    </>
  );
}
