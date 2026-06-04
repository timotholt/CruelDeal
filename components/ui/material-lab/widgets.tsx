import { For, JSX, Show } from 'solid-js';

// Small presentational widgets used alongside surfaces but not part of the
// surface system itself.

export interface SectionLabelProps {
  children: string;
  size?: 'xs' | 'sm' | 'md';
  tone?: 'default' | 'muted' | 'gold';
  slashes?: boolean;
  class?: string;
}

export interface StatBlockProps {
  label: string;
  value: string;
  icon?: JSX.Element;
  tone?: 'default' | 'gold' | 'red' | 'cyan';
}

export interface SegmentedMeterProps {
  value: number;
  segments?: number;
  tone?: 'gold' | 'red' | 'cyan' | 'white';
  showPercent?: boolean;
}

export const SectionLabel = (props: SectionLabelProps) => (
  <div class={`cd-section-label cd-section-label--${props.size || 'md'} cd-section-label--${props.tone || 'default'} ${props.class || ''}`}>
    <Show when={props.slashes !== false}>
      <span class="cd-section-label__slashes">//</span>
    </Show>
    <span>{props.children}</span>
  </div>
);

export const StatBlock = (props: StatBlockProps) => (
  <div class={`cd-stat-block cd-stat-block--${props.tone || 'default'}`}>
    <Show when={props.icon}>
      <span class="cd-stat-block__icon">{props.icon}</span>
    </Show>
    <span class="cd-stat-block__text">
      <span class="cd-stat-block__label">{props.label}</span>
      <span class="cd-stat-block__value">{props.value}</span>
    </span>
  </div>
);

export const SegmentedMeter = (props: SegmentedMeterProps) => {
  const segments = () => props.segments || 10;
  const activeCount = () => Math.round(Math.max(0, Math.min(100, props.value)) / 100 * segments());

  return (
    <div class={`cd-meter cd-meter--${props.tone || 'gold'}`}>
      <div class="cd-meter__segments">
        <For each={Array.from({ length: segments() })}>
          {(_, index) => <span class={index() < activeCount() ? 'is-active' : ''} />}
        </For>
      </div>
      <Show when={props.showPercent}>
        <span class="cd-meter__value">{props.value}%</span>
      </Show>
    </div>
  );
};
