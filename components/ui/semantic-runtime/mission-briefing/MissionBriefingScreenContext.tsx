import { For, type JSX } from 'solid-js';
import '../../../../src/styles/mission-briefing-shell.css';

export type MissionShellDestination =
  | 'messages'
  | 'news'
  | 'missions'
  | 'events'
  | 'collection'
  | 'operations'
  | 'home'
  | 'market'
  | 'profile';

export interface MissionBriefingShellData {
  playerName: string;
  level: number;
  currentXp: number;
  targetXp: number;
  credits: number;
  data: number;
}

const iconPaths: Record<MissionShellDestination | 'add' | 'level', JSX.Element> = {
  messages: <><path d="M4 5h16v11H9l-5 4V5Z" /><path d="M8 9h8M8 12h5" /></>,
  news: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 7h6M9 11h6M9 15h3M15 15h1" /></>,
  missions: <><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></>,
  events: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 2v6M16 2v6M4 10h16M8 14h2M14 14h2" /></>,
  collection: <><rect x="5" y="3" width="13" height="17" rx="1" /><path d="M8 1h13v17M2 6h3v16h13v-2" /></>,
  operations: <><path d="M4 4l16 16M20 4 4 20M7 3l-4 4M21 17l-4 4M17 3l4 4M3 17l4 4" /></>,
  home: <><path d="M4 11 12 4l8 7v9H4v-9Z" /><path d="M9 20v-6h6v6" /></>,
  market: <><path d="m12 3 8 5v8l-8 5-8-5V8l8-5Z" /><path d="m4 8 8 5 8-5M12 13v8" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 22a8 8 0 0 1 16 0" /></>,
  add: <path d="M12 4v16M4 12h16" />,
  level: <><path d="m12 2 8 5v10l-8 5-8-5V7l8-5Z" /><path d="m8 12 3 3 5-7" /></>,
};

const ShellIcon = (props: { id: MissionShellDestination | 'add' | 'level' }) => (
  <svg class="mission-v2-shell-icon" viewBox="0 0 24 24" aria-hidden="true">
    {iconPaths[props.id]}
  </svg>
);

const activityItems: Array<{ id: MissionShellDestination; label: string; notified?: boolean }> = [
  { id: 'messages', label: 'Messages', notified: true },
  { id: 'news', label: 'News' },
  { id: 'missions', label: 'Missions', notified: true },
  { id: 'events', label: 'Events' },
];

const primaryItems: Array<{ id: MissionShellDestination; label: string }> = [
  { id: 'collection', label: 'Collection' },
  { id: 'operations', label: 'Operations' },
  { id: 'home', label: 'Home' },
  { id: 'market', label: 'Market' },
  { id: 'profile', label: 'Profile' },
];

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value);

export const MissionBriefingScreenContext = (props: {
  data: MissionBriefingShellData;
  backgroundUrl?: string;
  onNavigate?: (destination: MissionShellDestination) => void;
  onAddResource?: () => void;
}) => (
  <div class="mission-v2-screen-context" data-semantic-component="MissionBriefingScreenContext">
    <img
      class="mission-v2-screen-context__media"
      src={props.backgroundUrl ?? '/art/login/editor-temp-bg.png'}
      alt=""
      aria-hidden="true"
      draggable={false}
    />

    <section class="mission-v2-player-summary" aria-label="Player summary">
      <img class="mission-v2-player-summary__portrait" src="/art/mission-v2/netrunner-07-portrait-r0.png" alt="" />
      <div class="mission-v2-player-summary__identity">
        <strong>{props.data.playerName}</strong>
        <span>LVL {props.data.level}</span>
        <progress value={props.data.currentXp} max={props.data.targetXp} aria-label="Level progress" />
        <span>{formatNumber(props.data.currentXp)} / {formatNumber(props.data.targetXp)} XP</span>
      </div>
      <ShellIcon id="level" />
    </section>

    <section class="mission-v2-resource-summary" aria-label="Resources">
      <div class="mission-v2-resource mission-v2-resource--credits"><i /><strong>{formatNumber(props.data.credits)}</strong><span>Credits</span></div>
      <div class="mission-v2-resource mission-v2-resource--data"><i /><strong>{formatNumber(props.data.data)}</strong><span>Data</span></div>
      <button type="button" aria-label="Add resources" onClick={() => props.onAddResource?.()}><ShellIcon id="add" /></button>
    </section>

    <nav class="mission-v2-activity-navigation" aria-label="Activity navigation">
      <For each={activityItems}>{(item) => (
        <button type="button" onClick={() => props.onNavigate?.(item.id)}>
          <span class="mission-v2-activity-navigation__icon"><ShellIcon id={item.id} />{item.notified ? <i /> : null}</span>
          <span>{item.label}</span>
        </button>
      )}</For>
    </nav>

    <nav class="mission-v2-primary-navigation" aria-label="Primary navigation">
      <For each={primaryItems}>{(item) => (
        <button
          type="button"
          class={item.id === 'home' ? 'is-active' : ''}
          aria-current={item.id === 'home' ? 'page' : undefined}
          onClick={() => props.onNavigate?.(item.id)}
        >
          <ShellIcon id={item.id} />
          <span>{item.label}</span>
        </button>
      )}</For>
    </nav>
  </div>
);
