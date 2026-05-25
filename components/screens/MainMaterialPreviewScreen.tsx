import { createEffect, createSignal, For, JSX, onMount, Show } from 'solid-js';
import '../../src/styles/ui-material-lab.css';
import '../../src/styles/main-material-preview.css';
import {
  MaterialWorkbenchLayout,
  SectionLabel,
  type MaterialWorkbenchPart,
} from '../ui/material-lab';

type MainPartId = 'backdrop' | 'titleBlock' | 'feedCards' | 'navBars';
type BackdropMode = 'company' | 'dark';

interface BackdropRecipe {
  mode: BackdropMode;
  dim: number;
  blur: number;
  scale: number;
  x: number;
  y: number;
  warm: number;
  dark: number;
}

interface TitleRecipe {
  title: string;
  subtitle: string;
  fontFamily: string;
  titleSize: number;
  tracking: number;
  x: number;
  y: number;
}

interface FeedRecipe {
  contentY: number;
  titleGap: number;
  cardGap: number;
  newsGap: number;
  radius: number;
}

interface NavRecipe {
  bottomReserve: number;
}

const storageKey = 'cruel-deal.main-material-preview.v2';

const partLabels: Array<MaterialWorkbenchPart<MainPartId>> = [
  { id: 'backdrop', label: 'Backdrop', detail: 'image tone' },
  { id: 'titleBlock', label: 'Title', detail: 'briefing type' },
  { id: 'feedCards', label: 'Feed', detail: 'card rhythm' },
  { id: 'navBars', label: 'Nav', detail: 'bottom reserve' },
];

const backdropModes: Array<{ id: BackdropMode; label: string; src: string }> = [
  { id: 'company', label: 'Final', src: '/art/login/cruel-company-final-login.png' },
  { id: 'dark', label: 'Dark', src: '/art/login/login-social-bg-dark.png' },
];

const fontOptions = [
  { label: 'Condensed', value: '"IBM Plex Sans Condensed", "Arial Narrow", ui-sans-serif, system-ui, sans-serif' },
  { label: 'Tech Mono', value: '"JetBrains Mono", "IBM Plex Sans Condensed", ui-monospace, monospace' },
  { label: 'DIN', value: '"DIN Condensed", "Bahnschrift", "Arial Narrow", ui-sans-serif, system-ui, sans-serif' },
  { label: 'Bank', value: '"Bank Gothic", "Copperplate", "JetBrains Mono", ui-monospace, monospace' },
  { label: 'Wide', value: '"Arial Black", "Impact", ui-sans-serif, system-ui, sans-serif' },
  { label: 'System', value: 'ui-sans-serif, system-ui, sans-serif' },
] as const;

const defaultBackdrop: BackdropRecipe = {
  mode: 'company',
  dim: 0,
  blur: 0,
  scale: 100,
  x: 0,
  y: 0,
  warm: 34,
  dark: 10,
};

const defaultTitle: TitleRecipe = {
  title: 'WELCOME BACK',
  subtitle: 'DAILY BRIEFING',
  fontFamily: fontOptions[0].value,
  titleSize: 32,
  tracking: 1,
  x: 0,
  y: 0,
};

const defaultFeed: FeedRecipe = {
  contentY: 0,
  titleGap: 30,
  cardGap: 16,
  newsGap: 12,
  radius: 7,
};

const defaultNav: NavRecipe = {
  bottomReserve: 146,
};

const cloneBackdrop = (value: BackdropRecipe): BackdropRecipe => ({ ...value });
const cloneTitle = (value: TitleRecipe): TitleRecipe => ({ ...value });
const cloneFeed = (value: FeedRecipe): FeedRecipe => ({ ...value });
const cloneNav = (value: NavRecipe): NavRecipe => ({ ...value });

const clamp = (value: unknown, fallback: number, min: number, max: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

const sanitizeBackdrop = (value: unknown): BackdropRecipe => {
  const input = typeof value === 'object' && value !== null ? value as Partial<BackdropRecipe> : {};
  return {
    mode: input.mode === 'dark' ? 'dark' : defaultBackdrop.mode,
    dim: clamp(input.dim, defaultBackdrop.dim, 0, 80),
    blur: clamp(input.blur, defaultBackdrop.blur, 0, 18),
    scale: clamp(input.scale, defaultBackdrop.scale, 100, 130),
    x: clamp(input.x, defaultBackdrop.x, -120, 120),
    y: clamp(input.y, defaultBackdrop.y, -120, 120),
    warm: clamp(input.warm, defaultBackdrop.warm, 0, 100),
    dark: clamp(input.dark, defaultBackdrop.dark, 0, 100),
  };
};

const sanitizeTitle = (value: unknown): TitleRecipe => {
  const input = typeof value === 'object' && value !== null ? value as Partial<TitleRecipe> : {};
  return {
    title: typeof input.title === 'string' && input.title.trim() ? input.title : defaultTitle.title,
    subtitle: typeof input.subtitle === 'string' && input.subtitle.trim() ? input.subtitle : defaultTitle.subtitle,
    fontFamily: typeof input.fontFamily === 'string' && fontOptions.some((option) => option.value === input.fontFamily)
      ? input.fontFamily
      : defaultTitle.fontFamily,
    titleSize: clamp(input.titleSize, defaultTitle.titleSize, 20, 44),
    tracking: clamp(input.tracking, defaultTitle.tracking, 0, 18),
    x: clamp(input.x, defaultTitle.x, -80, 80),
    y: clamp(input.y, defaultTitle.y, -80, 80),
  };
};

const sanitizeFeed = (value: unknown): FeedRecipe => {
  const input = typeof value === 'object' && value !== null ? value as Partial<FeedRecipe> : {};
  return {
    contentY: clamp(input.contentY, defaultFeed.contentY, -32, 48),
    titleGap: clamp(input.titleGap, defaultFeed.titleGap, 10, 50),
    cardGap: clamp(input.cardGap, defaultFeed.cardGap, 8, 32),
    newsGap: clamp(input.newsGap, defaultFeed.newsGap, 6, 28),
    radius: clamp(input.radius, defaultFeed.radius, 0, 12),
  };
};

const sanitizeNav = (value: unknown): NavRecipe => {
  const input = typeof value === 'object' && value !== null ? value as Partial<NavRecipe> : {};
  return {
    bottomReserve: clamp(input.bottomReserve, defaultNav.bottomReserve, 120, 184),
  };
};

const Slider = (props: { value: number; min?: number; max?: number; onInput: (value: number) => void }) => (
  <label class="ui-lab-slider">
    <input
      type="range"
      min={props.min ?? 0}
      max={props.max ?? 100}
      value={props.value}
      onInput={(event) => props.onInput(Number(event.currentTarget.value))}
    />
    <output>{props.value}</output>
  </label>
);

const MiniButton = (props: { active?: boolean; children: JSX.Element; onClick: () => void }) => (
  <button
    type="button"
    class={`ui-lab-mini-button ${props.active ? 'is-active' : ''}`}
    onClick={props.onClick}
  >
    {props.children}
  </button>
);

const BackdropRecipeEditor = (props: { backdrop: BackdropRecipe; onChange: (backdrop: BackdropRecipe) => void }) => {
  const update = <K extends keyof BackdropRecipe>(key: K, value: BackdropRecipe[K]) => {
    props.onChange({ ...props.backdrop, [key]: value });
  };

  return (
    <div class="ui-lab-control-group">
      <SectionLabel size="xs">Backdrop</SectionLabel>
      <div class="ui-lab-control-row">
        <span>Mode</span>
        <div class="ui-lab-toggles">
          <For each={backdropModes}>
            {(mode) => (
              <MiniButton active={props.backdrop.mode === mode.id} onClick={() => update('mode', mode.id)}>
                {mode.label}
              </MiniButton>
            )}
          </For>
        </div>
      </div>
      <div class="ui-lab-control-row">
        <span>Dim</span>
        <Slider value={props.backdrop.dim} min={0} max={80} onInput={(value) => update('dim', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Blur</span>
        <Slider value={props.backdrop.blur} min={0} max={18} onInput={(value) => update('blur', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Scale</span>
        <Slider value={props.backdrop.scale} min={100} max={130} onInput={(value) => update('scale', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>X</span>
        <Slider value={props.backdrop.x} min={-120} max={120} onInput={(value) => update('x', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Y</span>
        <Slider value={props.backdrop.y} min={-120} max={120} onInput={(value) => update('y', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Warmth</span>
        <Slider value={props.backdrop.warm} onInput={(value) => update('warm', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Dark</span>
        <Slider value={props.backdrop.dark} onInput={(value) => update('dark', value)} />
      </div>
    </div>
  );
};

const TitleRecipeEditor = (props: { title: TitleRecipe; onChange: (title: TitleRecipe) => void }) => {
  const [fontPickerOpen, setFontPickerOpen] = createSignal(false);
  const update = <K extends keyof TitleRecipe>(key: K, value: TitleRecipe[K]) => {
    props.onChange({ ...props.title, [key]: value });
  };

  return (
    <div class="ui-lab-control-group">
      <SectionLabel size="xs">Title</SectionLabel>
      <div class="ui-lab-control-row">
        <span>Title</span>
        <input class="ui-lab-input main-material-text-input" value={props.title.title} onInput={(event) => update('title', event.currentTarget.value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Subtitle</span>
        <input class="ui-lab-input main-material-text-input" value={props.title.subtitle} onInput={(event) => update('subtitle', event.currentTarget.value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Font</span>
        <div class="main-material-font-control">
          <button type="button" class="ui-lab-mini-button" onClick={() => setFontPickerOpen(!fontPickerOpen())}>
            Tune Font
          </button>
          <Show when={fontPickerOpen()}>
            <div class="main-material-font-popover">
              <For each={fontOptions}>
                {(font) => (
                  <button
                    type="button"
                    class={`ui-lab-mini-button ${props.title.fontFamily === font.value ? 'is-active' : ''}`}
                    style={{ 'font-family': font.value }}
                    onClick={() => {
                      update('fontFamily', font.value);
                      setFontPickerOpen(false);
                    }}
                  >
                    {font.label}
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
      <div class="ui-lab-control-row">
        <span>Size</span>
        <Slider value={props.title.titleSize} min={20} max={44} onInput={(value) => update('titleSize', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Track</span>
        <Slider value={props.title.tracking} min={0} max={18} onInput={(value) => update('tracking', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>X</span>
        <Slider value={props.title.x} min={-80} max={80} onInput={(value) => update('x', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Y</span>
        <Slider value={props.title.y} min={-80} max={80} onInput={(value) => update('y', value)} />
      </div>
    </div>
  );
};

const FeedRecipeEditor = (props: { feed: FeedRecipe; onChange: (feed: FeedRecipe) => void }) => {
  const update = <K extends keyof FeedRecipe>(key: K, value: FeedRecipe[K]) => {
    props.onChange({ ...props.feed, [key]: value });
  };

  return (
    <div class="ui-lab-control-group">
      <SectionLabel size="xs">Feed Layout</SectionLabel>
      <div class="ui-lab-control-row">
        <span>Content Y</span>
        <Slider value={props.feed.contentY} min={-32} max={48} onInput={(value) => update('contentY', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Title Gap</span>
        <Slider value={props.feed.titleGap} min={10} max={50} onInput={(value) => update('titleGap', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Card Gap</span>
        <Slider value={props.feed.cardGap} min={8} max={32} onInput={(value) => update('cardGap', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>News Gap</span>
        <Slider value={props.feed.newsGap} min={6} max={28} onInput={(value) => update('newsGap', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Radius</span>
        <Slider value={props.feed.radius} min={0} max={12} onInput={(value) => update('radius', value)} />
      </div>
    </div>
  );
};

const NavRecipeEditor = (props: { nav: NavRecipe; onChange: (nav: NavRecipe) => void }) => (
  <div class="ui-lab-control-group">
    <SectionLabel size="xs">Navigation</SectionLabel>
    <div class="ui-lab-control-row">
      <span>Reserve</span>
      <Slider
        value={props.nav.bottomReserve}
        min={120}
        max={184}
        onInput={(value) => props.onChange({ ...props.nav, bottomReserve: value })}
      />
    </div>
  </div>
);

const FakeProfileIcon = () => (
  <div class="main-material-profile-button" aria-hidden="true">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8">
      <path d="M16 7a4 4 0 1 1-8 0a4 4 0 0 1 8 0Z" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </svg>
  </div>
);

const MainMaterialPreview = (props: {
  selectedClass: (part: MainPartId) => string;
  backdrop: BackdropRecipe;
  title: TitleRecipe;
  feed: FeedRecipe;
  nav: NavRecipe;
}) => {
  const selectedBackdropMode = () => backdropModes.find((mode) => mode.id === props.backdrop.mode) ?? backdropModes[0];
  const style = () => ({
    '--main-bg-dim': `${props.backdrop.dim / 100}`,
    '--main-bg-blur': `${props.backdrop.blur}px`,
    '--main-bg-scale': `${props.backdrop.scale / 100}`,
    '--main-bg-x': `${props.backdrop.x}px`,
    '--main-bg-y': `${props.backdrop.y}px`,
    '--main-bg-warm': `${props.backdrop.warm / 100}`,
    '--main-bg-dark': `${props.backdrop.dark / 100}`,
    '--main-title-font': props.title.fontFamily,
    '--main-title-size': `${props.title.titleSize}px`,
    '--main-title-tracking': `${props.title.tracking / 100}em`,
    '--main-title-x': `${props.title.x}px`,
    '--main-title-y': `${props.title.y}px`,
    '--main-content-y': `${props.feed.contentY}px`,
    '--main-title-gap': `${props.feed.titleGap}px`,
    '--main-card-gap': `${props.feed.cardGap}px`,
    '--main-news-gap': `${props.feed.newsGap}px`,
    '--main-card-radius': `${props.feed.radius}px`,
    '--main-bottom-reserve': `${props.nav.bottomReserve}px`,
  }) as JSX.CSSProperties;

  return (
    <div class="main-material-phone" style={style()}>
      <div class="main-material-screen">
        <img class={`main-material-bg ${props.selectedClass('backdrop')}`} src={selectedBackdropMode().src} alt="" />
        <div class="main-material-wash" />
        <div class="main-material-grain" />
        <div class="main-material-frame">
          <header class="main-material-topbar">
            <div class="main-material-profile-slot"><FakeProfileIcon /></div>
            <div class="main-material-commander">COMMANDER</div>
            <div class="main-material-currencies">
              <button type="button" class="main-material-currency-chip main-material-currency-chip--credits">500</button>
              <button type="button" class="main-material-currency-chip main-material-currency-chip--gold">5400</button>
              <button type="button" class="main-material-currency-chip main-material-currency-chip--tokens">3050</button>
            </div>
          </header>

          <main class="main-material-scroll">
            <section class={`main-material-title-block ${props.selectedClass('titleBlock')}`}>
              <h1>{props.title.title}</h1>
              <p>{props.title.subtitle}</p>
            </section>

            <section class={`main-material-hero ${props.selectedClass('feedCards')}`}>
              <div class="main-material-hero-content">
                <div class="main-material-tag">SEASON PASS</div>
                <h2>COSMIC ECLIPSE</h2>
                <p>Unlock the new Titan variant and earn double credits this weekend.</p>
              </div>
            </section>

            <div class={`main-material-news-list ${props.selectedClass('feedCards')}`}>
              <article class="main-material-news-card main-material-news-card--dark">
                <div class="main-material-tag">PATCH NOTES</div>
                <h3>Update 1.4.0: Spatial UI</h3>
                <p>Navigation has been rebuilt for faster daily command decisions.</p>
              </article>
              <article class="main-material-news-card">
                <div class="main-material-tag">COMMUNITY</div>
                <h3>Top Decks of the Week</h3>
                <p>See what the pros are using to climb the company ladder.</p>
              </article>
            </div>

            <div class="main-material-end">END OF TRANSMISSION</div>
          </main>
        </div>

        <div class={`main-material-fake-command ${props.selectedClass('navBars')}`}>
          <button type="button" class="main-material-action main-material-action--dark"><span>LOG</span></button>
          <button type="button" class="main-material-action"><span>PLAY{'\n'}CONQUEST</span></button>
          <button type="button" class="main-material-action main-material-action--red"><span>DECK{'\n'}ASSAULT</span></button>
          <button type="button" class="main-material-action"><span>PLAY{'\n'}LADDER</span></button>
          <button type="button" class="main-material-action main-material-action--dark"><span>10</span></button>
        </div>

        <nav class={`main-material-fake-nav ${props.selectedClass('navBars')}`}>
          <button type="button" class="main-material-nav-item"><span class="main-material-nav-icon">*</span><span class="main-material-nav-label">Season</span></button>
          <button type="button" class="main-material-nav-item"><span class="main-material-nav-icon">M</span><span class="main-material-nav-label">Inbox</span></button>
          <button type="button" class="main-material-nav-item is-active"><span class="main-material-nav-icon">V</span><span class="main-material-nav-label">Main</span></button>
          <button type="button" class="main-material-nav-item"><span class="main-material-nav-icon">B</span><span class="main-material-nav-label">Collection</span></button>
          <button type="button" class="main-material-nav-item"><span class="main-material-nav-icon">$</span><span class="main-material-nav-label">Store</span></button>
        </nav>
      </div>
    </div>
  );
};

export const MainMaterialPreviewScreen = () => {
  const [selectedPart, setSelectedPart] = createSignal<MainPartId>('feedCards');
  const [backdrop, setBackdrop] = createSignal<BackdropRecipe>(cloneBackdrop(defaultBackdrop));
  const [title, setTitle] = createSignal<TitleRecipe>(cloneTitle(defaultTitle));
  const [feed, setFeed] = createSignal<FeedRecipe>(cloneFeed(defaultFeed));
  const [nav, setNav] = createSignal<NavRecipe>(cloneNav(defaultNav));

  onMount(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        backdrop?: unknown;
        title?: unknown;
        feed?: unknown;
        nav?: unknown;
      };
      setBackdrop(sanitizeBackdrop(parsed.backdrop));
      setTitle(sanitizeTitle(parsed.title));
      setFeed(sanitizeFeed(parsed.feed));
      setNav(sanitizeNav(parsed.nav));
    } catch {
      setBackdrop(cloneBackdrop(defaultBackdrop));
      setTitle(cloneTitle(defaultTitle));
      setFeed(cloneFeed(defaultFeed));
      setNav(cloneNav(defaultNav));
    }
  });

  createEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify({
      backdrop: backdrop(),
      title: title(),
      feed: feed(),
      nav: nav(),
    }));
  });

  const resetSelected = () => {
    const part = selectedPart();
    if (part === 'backdrop') setBackdrop(cloneBackdrop(defaultBackdrop));
    if (part === 'titleBlock') setTitle(cloneTitle(defaultTitle));
    if (part === 'feedCards') setFeed(cloneFeed(defaultFeed));
    if (part === 'navBars') setNav(cloneNav(defaultNav));
  };

  const resetAll = () => {
    setBackdrop(cloneBackdrop(defaultBackdrop));
    setTitle(cloneTitle(defaultTitle));
    setFeed(cloneFeed(defaultFeed));
    setNav(cloneNav(defaultNav));
  };

  const exportJson = () => {
    void navigator.clipboard?.writeText(JSON.stringify({
      backdrop: backdrop(),
      title: title(),
      feed: feed(),
      nav: nav(),
    }, null, 2));
  };

  const selectedClass = (part: MainPartId) => selectedPart() === part ? 'is-editing' : '';

  const editor = (
    <Show
      when={selectedPart() === 'backdrop'}
      fallback={(
        <Show
          when={selectedPart() === 'titleBlock'}
          fallback={(
            <Show
              when={selectedPart() === 'feedCards'}
              fallback={(
                <Show when={selectedPart() === 'navBars'} fallback={null}>
                  <NavRecipeEditor nav={nav()} onChange={setNav} />
                </Show>
              )}
            >
              <FeedRecipeEditor feed={feed()} onChange={setFeed} />
            </Show>
          )}
        >
          <TitleRecipeEditor title={title()} onChange={setTitle} />
        </Show>
      )}
    >
      <BackdropRecipeEditor backdrop={backdrop()} onChange={setBackdrop} />
    </Show>
  );

  return (
    <MaterialWorkbenchLayout
      title="Main Skin"
      subtitle="Material Preview"
      parts={partLabels}
      selectedPartId={selectedPart()}
      onSelectPart={setSelectedPart}
      preview={(
        <MainMaterialPreview
          selectedClass={selectedClass}
          backdrop={backdrop()}
          title={title()}
          feed={feed()}
          nav={nav()}
        />
      )}
      editor={editor}
      actions={<button type="button" class="ui-lab-mini-button" onClick={exportJson}>Export</button>}
      footer={(
        <>
          <button type="button" class="ui-lab-mini-button" onClick={resetSelected}>Reset Selected</button>
          <button type="button" class="ui-lab-mini-button" onClick={resetAll}>Reset All</button>
        </>
      )}
      class="main-material-page"
    />
  );
};

export default MainMaterialPreviewScreen;
