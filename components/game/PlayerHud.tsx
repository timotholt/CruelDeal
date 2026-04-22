import { Show, JSX, createSignal, createEffect } from 'solid-js';

/**
 * PlayerHud — in-game corner widget.
 *
 * avatar accepts:
 *   string starting with "/" or "http" → rendered as <img>
 *   string (anything else)             → used as CSS background (color, gradient)
 *   JSX.Element                        → rendered directly inside avatar ring
 *
 * hasPriority shows a gold ★ — goes first this reveal phase.
 * side controls layout direction (row vs row-reverse).
 */
export interface PlayerHudProps {
  name: string;
  avatar?: string | JSX.Element;
  hasPriority?: boolean;
  side: 'left' | 'right';
}

function isUrl(s: string) {
  return s.startsWith('/') || s.startsWith('http');
}

export const PlayerHud = (props: PlayerHudProps) => {
  // Decouple displayed state from props so we can play exit animation before unmounting
  const [starVisible, setStarVisible] = createSignal(props.hasPriority ?? false);
  const [starClass, setStarClass] = createSignal('');
  let exitTimer: ReturnType<typeof setTimeout> | undefined;

  createEffect(() => {
    const next = props.hasPriority ?? false;
    const cur = starVisible();
    if (next === cur) return;

    clearTimeout(exitTimer);
    if (next) {
      // incoming priority: wait for other side's exit, then enter
      exitTimer = setTimeout(() => {
        setStarVisible(true);
        setStarClass('priority-enter');
        setTimeout(() => setStarClass(''), 1500);
      }, 1000);
    } else {
      // losing priority: play exit, then hide
      setStarClass('priority-leave');
      exitTimer = setTimeout(() => {
        setStarVisible(false);
        setStarClass('');
      }, 1500);
    }
  });

  const avatarContent = () => {
    const av = props.avatar;
    if (!av) return null;
    if (typeof av === 'string') {
      if (isUrl(av)) {
        return (
          <img
            src={av}
            alt={props.name}
            style={{ width: '100%', height: '100%', 'object-fit': 'cover', 'border-radius': '50%' }}
          />
        );
      }
      // CSS color/gradient — applied as background below
      return null;
    }
    // JSX element
    return av as JSX.Element;
  };

  const avatarBg = () => {
    const av = props.avatar;
    if (typeof av === 'string' && !isUrl(av)) return av;
    return 'linear-gradient(135deg, var(--bg-2), var(--bg-1))';
  };

  return (
    <div
      class="player-hud"
      classList={{ 'player-hud--right': props.side === 'right' }}
    >
      {/* Avatar ring */}
      <div
        class="player-hud__avatar"
        style={{ background: avatarBg() }}
      >
        {avatarContent()}
      </div>

      {/* Name + priority */}
      <div class="player-hud__info">
        <span class="player-hud__name">{props.name}</span>
        <Show when={starVisible()}>
          <span
            class="player-hud__priority"
            classList={{ [starClass()]: !!starClass() }}
            title="Priority — reveals first"
          >★</span>
        </Show>
      </div>
    </div>
  );
};
