import { JSX } from 'solid-js';

interface IconProps {
  class?: string;
}

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
} as const;

const SvgIcon = (props: IconProps & { children: JSX.Element; viewBox?: string }) => (
  <svg
    class={props.class || 'w-5 h-5'}
    viewBox={props.viewBox || '0 0 24 24'}
    aria-hidden="true"
    {...strokeProps}
  >
    {props.children}
  </svg>
);

export const ArrowRightIcon = (props: IconProps) => (
  <SvgIcon class={props.class}>
    <path stroke-width="2.2" d="M5 12h13" />
    <path stroke-width="2.2" d="m13 6 6 6-6 6" />
  </SvgIcon>
);

export const PlusIcon = (props: IconProps) => (
  <SvgIcon class={props.class}>
    <path stroke-width="2.1" d="M12 5v14M5 12h14" />
  </SvgIcon>
);

export const SettingsIcon = (props: IconProps) => (
  <SvgIcon class={props.class}>
    <path stroke-width="1.9" d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" />
    <path stroke-width="1.9" d="m19.1 14.2 1.3 1-1.8 3.1-1.6-.6a7.4 7.4 0 0 1-1.8 1l-.3 1.7h-3.6l-.3-1.7a7.4 7.4 0 0 1-1.8-1l-1.6.6-1.8-3.1 1.3-1a7.8 7.8 0 0 1 0-2.2l-1.3-1 1.8-3.1 1.6.6a7.4 7.4 0 0 1 1.8-1l.3-1.7h3.6l.3 1.7a7.4 7.4 0 0 1 1.8 1l1.6-.6 1.8 3.1-1.3 1a7.8 7.8 0 0 1 0 2.2Z" />
  </SvgIcon>
);

export const UserIcon = (props: IconProps) => (
  <SvgIcon class={props.class}>
    <path stroke-width="2" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
    <path stroke-width="2" d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </SvgIcon>
);

export const CalendarIcon = (props: IconProps) => (
  <SvgIcon class={props.class}>
    <path stroke-width="2" d="M7 3v4M17 3v4M4.5 8h15M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
    <path stroke-width="1.7" d="M8 12h2M14 12h2M8 16h2M14 16h2" />
  </SvgIcon>
);

export const CubeIcon = (props: IconProps) => (
  <SvgIcon class={props.class}>
    <path stroke-width="1.9" d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
    <path stroke-width="1.9" d="m4 7.5 8 4.5 8-4.5M12 12v9" />
  </SvgIcon>
);

export const HistoryIcon = (props: IconProps) => (
  <SvgIcon class={props.class}>
    <path stroke-width="2" d="M4 12a8 8 0 1 0 2.35-5.65L4 8.7" />
    <path stroke-width="2" d="M4 4v4.7h4.7M12 7.5V12l3 2" />
  </SvgIcon>
);

export const DocumentIcon = (props: IconProps) => (
  <SvgIcon class={props.class}>
    <path stroke-width="1.9" d="M7 3.5h7l3 3V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
    <path stroke-width="1.9" d="M14 3.5v4h4M9 12h6M9 16h4" />
  </SvgIcon>
);

export const ClockIcon = (props: IconProps) => (
  <SvgIcon class={props.class}>
    <path stroke-width="2" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
    <path stroke-width="2" d="M12 7v5l3 2" />
  </SvgIcon>
);

export const RewardIcon = (props: IconProps) => (
  <SvgIcon class={props.class}>
    <path stroke-width="1.9" d="M8 9a4 4 0 1 1 8 0c0 3-4 5.5-4 5.5S8 12 8 9Z" />
    <path stroke-width="1.9" d="M9 15.5 7.5 21l4.5-2 4.5 2-1.5-5.5" />
    <path stroke-width="1.7" d="M12 7.5v3" />
  </SvgIcon>
);

export const ShieldHexIcon = (props: IconProps) => (
  <SvgIcon class={props.class}>
    <path stroke-width="1.9" d="M12 3.2 19 7v5.7c0 4.1-2.8 6.9-7 8.1-4.2-1.2-7-4-7-8.1V7l7-3.8Z" />
    <path stroke-width="1.7" d="m9.2 12 2 2 4-5" />
  </SvgIcon>
);

export const TargetMarkIcon = (props: IconProps) => (
  <SvgIcon class={props.class}>
    <circle cx="12" cy="12" r="8.5" stroke-width="1.7" />
    <path stroke-width="1.7" d="M12 3v5M12 16v5M3 12h5M16 12h5" />
    <path stroke-width="1.7" d="m9 15 3-8 3 8-3-2-3 2Z" />
  </SvgIcon>
);

export const HomeIcon = (props: IconProps) => (
  <SvgIcon class={props.class}>
    <path stroke-width="2" d="m4 11 8-7 8 7" />
    <path stroke-width="2" d="M6.5 10v10h11V10" />
  </SvgIcon>
);

export const CollectionIcon = (props: IconProps) => (
  <SvgIcon class={props.class}>
    <rect x="6" y="6" width="12" height="12" rx="1.5" stroke-width="1.8" />
    <path stroke-width="1.8" d="M3.5 9.5v-3a3 3 0 0 1 3-3h3M20.5 14.5v3a3 3 0 0 1-3 3h-3" />
  </SvgIcon>
);

export const OperationsIcon = (props: IconProps) => (
  <SvgIcon class={props.class}>
    <path stroke-width="1.8" d="M5 5l14 14M19 5 5 19" />
    <path stroke-width="1.6" d="m8 3 1.5 3L8 9 6.5 6 8 3ZM16 15l1.5 3L16 21l-1.5-3L16 15ZM16 3l1.5 3L16 9l-1.5-3L16 3ZM8 15l1.5 3L8 21l-1.5-3L8 15Z" />
  </SvgIcon>
);

export const MarketIcon = (props: IconProps) => (
  <SvgIcon class={props.class}>
    <path stroke-width="1.9" d="m12 3 8 4.4v9.2L12 21l-8-4.4V7.4L12 3Z" />
    <path stroke-width="1.7" d="m12 7 4.5 2.5V15L12 17.5 7.5 15V9.5L12 7Z" />
  </SvgIcon>
);

export const DataDiamondIcon = (props: IconProps) => (
  <SvgIcon class={props.class}>
    <path stroke-width="2.2" d="m12 3 8 9-8 9-8-9 8-9Z" />
    <path stroke-width="2" d="m12 8 3.5 4-3.5 4-3.5-4 3.5-4Z" />
  </SvgIcon>
);

export const CreditHexIcon = (props: IconProps) => (
  <SvgIcon class={props.class}>
    <path stroke-width="2" d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
    <path stroke-width="2" d="m12 8 3.5 2v4L12 16l-3.5-2v-4L12 8Z" />
  </SvgIcon>
);

