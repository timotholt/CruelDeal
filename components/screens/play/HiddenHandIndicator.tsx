import { For } from 'solid-js';

interface HiddenHandIndicatorProps {
  count: number;
  anchorRef?: (element: HTMLDivElement) => void;
}

export const HiddenHandIndicator = (props: HiddenHandIndicatorProps) => {
  const visibleBacks = () => Math.min(3, props.count);

  return (
    <div class="hidden-hand" aria-label={`Opponent hand size ${props.count}`} title={`Hand ${props.count}`}>
      <div
        ref={(element) => props.anchorRef?.(element)}
        class="hidden-hand__backs"
        data-zone-anchor="remote-hand"
      >
        <For each={Array.from({ length: visibleBacks() })}>
          {(_, index) => (
            <span
              class="hidden-hand__back"
              style={{
                transform: `translateX(${index() * 11}px) rotate(${(index() - 1) * 5}deg)`,
                'z-index': String(index() + 1),
              }}
            />
          )}
        </For>
      </div>
      <span class="hidden-hand__count">{props.count}</span>
    </div>
  );
};
