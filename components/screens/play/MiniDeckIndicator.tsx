interface MiniDeckIndicatorProps {
  count: number;
  label?: string;
  anchorRef?: (element: HTMLElement) => void;
}

/**
 * Visible remote-deck anchor.
 *
 * The stacked backs provide the player-facing count while the stack itself is
 * registered as the logical deck endpoint for card-transfer choreography.
 */
export const MiniDeckIndicator = (props: MiniDeckIndicatorProps) => {
  const label = () => props.label ?? 'Opponent deck';

  return (
    <div class="mini-deck" aria-label={`${label()} size ${props.count}`} title={`${label()} ${props.count}`}>
      <div
        class="mini-deck__stack"
        aria-hidden="true"
      >
        <span class="mini-deck__back mini-deck__back--rear" />
        <span class="mini-deck__back mini-deck__back--middle" />
        <span
          ref={(element) => props.anchorRef?.(element)}
          class="mini-deck__back mini-deck__back--front"
          data-zone-anchor="remote-deck"
          data-card-transfer-anchor="deck"
        />
      </div>
      <span class="mini-deck__count">{props.count}</span>
    </div>
  );
};
