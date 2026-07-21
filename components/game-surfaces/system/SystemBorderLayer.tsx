interface SystemBorderLayerProps {
  readonly surface: 'card' | 'location';
  readonly tone?: 'neutral' | 'friendly' | 'enemy';
  readonly layout?: 'regular' | 'spell';
}

export const SystemBorderLayer = (props: SystemBorderLayerProps) => (
  <div
    class={`system-border system-border--${props.surface} system-border--${props.tone ?? 'neutral'} system-border--${props.layout ?? 'regular'}`}
    data-surface-layer="chrome"
    aria-hidden="true"
  />
);
