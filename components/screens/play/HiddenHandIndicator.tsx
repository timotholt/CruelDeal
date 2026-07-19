import { For } from 'solid-js';

interface HiddenHandIndicatorProps {
  count: number;
  anchorRef?: (element: HTMLElement) => void;
}

export const HiddenHandIndicator = (props: HiddenHandIndicatorProps) => {
  const visibleBacks = () => Math.min(3, props.count);
  const transferAnchorLeft = () => Math.max(0, visibleBacks() - 1) * 11;

  return (
    <div class="hidden-hand" aria-label={`Opponent hand size ${props.count}`} title={`Hand ${props.count}`}>
      <div
        class="hidden-hand__backs"
      >
        <span
          ref={(element) => props.anchorRef?.(element)}
          class="hidden-hand__transfer-anchor"
          data-zone-anchor="remote-hand"
          data-card-transfer-anchor="hand"
          style={{ left: `${transferAnchorLeft()}px` }}
          aria-hidden="true"
        />
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
