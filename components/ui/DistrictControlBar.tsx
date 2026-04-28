import { createMemo, mergeProps, Show } from 'solid-js';

type DistrictControlBarSize = 'sm' | 'md' | 'lg';
type DistrictControlBarTone = 'dark' | 'glass' | 'minimal';

export interface DistrictControlPlayer {
  id: string;
  label: string;
  power: number;
  color: string;
}

export interface DistrictControlBarProps {
  districtName: string;
  leftPlayer: DistrictControlPlayer;
  rightPlayer: DistrictControlPlayer;
  size?: DistrictControlBarSize;
  tone?: DistrictControlBarTone;
  showPlayerLabels?: boolean;
  showWinnerGlow?: boolean;
  class?: string;
  style?: Record<string, string | number>;
  ariaLabel?: string;
}

const SIZE_STYLES: Record<DistrictControlBarSize, {
  width: string;
  padding: string;
  nameSize: string;
  numberSize: string;
  labelSize: string;
  barHeight: string;
  gap: string;
}> = {
  sm: {
    width: '7.5rem',
    padding: '0.22rem 0.32rem 0.28rem',
    nameSize: '0.48rem',
    numberSize: '0.66rem',
    labelSize: '0.42rem',
    barHeight: '0.28rem',
    gap: '0.24rem',
  },
  md: {
    width: '9.25rem',
    padding: '0.3rem 0.42rem 0.36rem',
    nameSize: '0.56rem',
    numberSize: '0.78rem',
    labelSize: '0.48rem',
    barHeight: '0.36rem',
    gap: '0.32rem',
  },
  lg: {
    width: '11rem',
    padding: '0.38rem 0.52rem 0.46rem',
    nameSize: '0.66rem',
    numberSize: '0.92rem',
    labelSize: '0.54rem',
    barHeight: '0.44rem',
    gap: '0.4rem',
  },
};

const TONE_STYLES: Record<DistrictControlBarTone, Record<string, string>> = {
  dark: {
    background: 'rgba(3, 7, 18, 0.78)',
    border: '1px solid rgba(148, 163, 184, 0.22)',
    'box-shadow': '0 0.5rem 1.5rem rgba(0, 0, 0, 0.45), inset 0 0 0.75rem rgba(15, 23, 42, 0.72)',
  },
  glass: {
    background: 'rgba(15, 23, 42, 0.48)',
    border: '1px solid rgba(125, 211, 252, 0.26)',
    'box-shadow': '0 0.35rem 1.2rem rgba(8, 47, 73, 0.36), inset 0 0 0.9rem rgba(14, 165, 233, 0.08)',
    'backdrop-filter': 'blur(8px)',
  },
  minimal: {
    background: 'rgba(2, 6, 23, 0.36)',
    border: '1px solid rgba(148, 163, 184, 0.14)',
    'box-shadow': 'none',
  },
};

const clampPower = (power: number): number => {
  if (!Number.isFinite(power)) return 0;
  return Math.max(0, Math.round(power));
};

export const DistrictControlBar = (rawProps: DistrictControlBarProps) => {
  const props = mergeProps({
    size: 'md' as DistrictControlBarSize,
    tone: 'dark' as DistrictControlBarTone,
    showPlayerLabels: true,
    showWinnerGlow: true,
    class: '',
  }, rawProps);

  const size = createMemo(() => SIZE_STYLES[props.size]);
  const leftPower = createMemo(() => clampPower(props.leftPlayer.power));
  const rightPower = createMemo(() => clampPower(props.rightPlayer.power));
  const totalPower = createMemo(() => leftPower() + rightPower());
  const leader = createMemo<'left' | 'right' | 'tie'>(() => {
    if (leftPower() > rightPower()) return 'left';
    if (rightPower() > leftPower()) return 'right';
    return 'tie';
  });
  const leftShare = createMemo(() => {
    if (totalPower() <= 0) return 0.5;
    return leftPower() / totalPower();
  });
  const leftPercent = createMemo(() => `${Math.max(8, Math.min(92, leftShare() * 100))}%`);
  const rightPercent = createMemo(() => `${Math.max(8, Math.min(92, (1 - leftShare()) * 100))}%`);
  const glowColor = createMemo(() => {
    if (!props.showWinnerGlow || leader() === 'tie') return 'rgba(226, 232, 240, 0.22)';
    return leader() === 'left' ? props.leftPlayer.color : props.rightPlayer.color;
  });
  const ariaLabel = createMemo(() => props.ariaLabel
    ?? `${props.districtName}: ${props.leftPlayer.label} ${leftPower()}, ${props.rightPlayer.label} ${rightPower()}`);

  return (
    <div
      class={`district-control-bar ${props.class}`}
      role="meter"
      aria-label={ariaLabel()}
      aria-valuetext={ariaLabel()}
      style={{
        ...TONE_STYLES[props.tone],
        ...props.style,
        width: size().width,
        padding: size().padding,
        'border-radius': '0.38rem',
        color: '#e2e8f0',
        display: 'flex',
        'flex-direction': 'column',
        gap: size().gap,
        'text-transform': 'uppercase',
        'letter-spacing': '0.12em',
        filter: props.showWinnerGlow ? `drop-shadow(0 0 0.45rem ${glowColor()})` : undefined,
      }}
    >
      <div
        style={{
          'font-size': size().nameSize,
          'font-weight': 900,
          color: '#dbeafe',
          'text-align': 'center',
          'line-height': 1,
          overflow: 'hidden',
          'text-overflow': 'ellipsis',
          'white-space': 'nowrap',
          'text-shadow': '0 0 0.45rem rgba(96, 165, 250, 0.55)',
        }}
      >
        {props.districtName}
      </div>

      <div
        style={{
          display: 'grid',
          'grid-template-columns': 'auto 1fr auto',
          gap: size().gap,
          'align-items': 'center',
        }}
      >
        <PowerEdge
          label={props.leftPlayer.label}
          power={leftPower()}
          color={props.leftPlayer.color}
          align="left"
          active={leader() === 'left'}
          showLabel={props.showPlayerLabels}
          numberSize={size().numberSize}
          labelSize={size().labelSize}
        />

        <div
          style={{
            position: 'relative',
            height: size().barHeight,
            overflow: 'hidden',
            'border-radius': '999px',
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid rgba(226, 232, 240, 0.18)',
            'box-shadow': 'inset 0 0 0.35rem rgba(0, 0, 0, 0.85)',
          }}
        >
          <Show when={totalPower() > 0} fallback={<NeutralFill />}>
            <div
              style={{
                position: 'absolute',
                inset: '0 auto 0 0',
                width: leftPercent(),
                background: `linear-gradient(90deg, ${props.leftPlayer.color}, rgba(255, 255, 255, 0.28))`,
                opacity: leader() === 'right' ? 0.58 : 0.92,
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: '0 0 0 auto',
                width: rightPercent(),
                background: `linear-gradient(270deg, ${props.rightPlayer.color}, rgba(255, 255, 255, 0.28))`,
                opacity: leader() === 'left' ? 0.58 : 0.92,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '-20%',
                bottom: '-20%',
                left: leftPercent(),
                width: '1px',
                background: leader() === 'tie' ? 'rgba(248, 250, 252, 0.95)' : 'rgba(248, 250, 252, 0.45)',
                'box-shadow': '0 0 0.45rem rgba(255, 255, 255, 0.9)',
              }}
            />
          </Show>
        </div>

        <PowerEdge
          label={props.rightPlayer.label}
          power={rightPower()}
          color={props.rightPlayer.color}
          align="right"
          active={leader() === 'right'}
          showLabel={props.showPlayerLabels}
          numberSize={size().numberSize}
          labelSize={size().labelSize}
        />
      </div>
    </div>
  );
};

const NeutralFill = () => (
  <div
    style={{
      position: 'absolute',
      inset: '0',
      background: 'linear-gradient(90deg, rgba(100, 116, 139, 0.25), rgba(226, 232, 240, 0.28), rgba(100, 116, 139, 0.25))',
    }}
  />
);

const PowerEdge = (props: {
  label: string;
  power: number;
  color: string;
  align: 'left' | 'right';
  active: boolean;
  showLabel: boolean;
  numberSize: string;
  labelSize: string;
}) => (
  <div
    style={{
      display: 'flex',
      'flex-direction': props.align === 'left' ? 'row' : 'row-reverse',
      'align-items': 'baseline',
      gap: '0.16rem',
      color: props.active ? '#ffffff' : '#94a3b8',
      'text-shadow': props.active ? `0 0 0.45rem ${props.color}` : 'none',
      'min-width': '2.35rem',
      'justify-content': props.align === 'left' ? 'flex-start' : 'flex-end',
    }}
  >
    <Show when={props.showLabel}>
      <span
        style={{
          color: props.color,
          'font-size': props.labelSize,
          'font-weight': 900,
          'line-height': 1,
        }}
      >
        {props.label}
      </span>
    </Show>
    <span
      style={{
        color: props.active ? '#ffffff' : '#cbd5e1',
        'font-size': props.numberSize,
        'font-weight': 950,
        'font-style': 'italic',
        'line-height': 1,
        'font-variant-numeric': 'tabular-nums',
      }}
    >
      {props.power}
    </span>
  </div>
);
