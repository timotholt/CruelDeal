import { For, Show } from 'solid-js';
import type { GameUiRuntime } from './gameUiResolvers';
import { createPromoSlotModel } from './gameUiComponentModels';
import { PromoCard } from './PromoCard';

export const PromoSlot = (props: {
  runtime: GameUiRuntime;
  placementPath: string;
  variant?: 'card' | 'hero';
  onAction?: (actionId: string, params?: Record<string, string | number | boolean>) => void;
}) => {
  const model = () => createPromoSlotModel(props.runtime, props.placementPath, props.variant ?? 'card');

  return (
    <section
      class={`game-ui-promo-slot game-ui-promo-slot--${props.variant ?? 'card'}`}
      data-placement-path={props.placementPath}
    >
      <Show
        when={model().items.length > 0}
        fallback={<span class="game-ui-promo-slot__empty">No promo content</span>}
      >
        <For each={model().items}>
          {(item) => (
            <PromoCard
              theme={props.runtime.theme}
              item={item}
              skin={model().skin}
              variant={props.variant}
              onAction={props.onAction}
            />
          )}
        </For>
      </Show>
    </section>
  );
};
