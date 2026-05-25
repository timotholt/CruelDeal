import { createEffect, createSignal, For, JSX, onMount, Show } from 'solid-js';
import '../../src/styles/ui-material-lab.css';
import '../../src/styles/login-material-preview.css';
import {
  MaterialWorkbenchLayout,
  SectionLabel,
  type MaterialWorkbenchPart,
} from '../ui/material-lab';

type LoginPartId = 'backdrop' | 'brandPlate' | 'authPanel';
type BackdropMode = 'light' | 'dark';

interface BackdropRecipe {
  mode: BackdropMode;
  dim: number;
  blur: number;
  scale: number;
  x: number;
  y: number;
  goldWash: number;
  darkWash: number;
}

interface BrandTextRecipe {
  title: string;
  fontFamily: string;
  align: 'left' | 'center' | 'right';
  titleSize: number;
  x: number;
  y: number;
  letterSpacing: number;
}

interface AuthLayoutRecipe {
  offsetY: number;
  gap: number;
}

const storageKey = 'cruel-deal.login-material-preview.v7';

const partLabels: Array<MaterialWorkbenchPart<LoginPartId>> = [
  { id: 'backdrop', label: 'Backdrop', detail: 'image tone' },
  { id: 'brandPlate', label: 'Brand Plate', detail: 'logo lockup' },
  { id: 'authPanel', label: 'Auth Panel', detail: 'layout shell' },
];

const defaultBackdrop: BackdropRecipe = {
  mode: 'light',
  dim: 0,
  blur: 0,
  scale: 107,
  x: 0,
  y: -22,
  goldWash: 0,
  darkWash: 0,
};

const backdropModes: Array<{ id: BackdropMode; label: string; src: string }> = [
  { id: 'light', label: 'Light', src: '/art/login/login-social-bg.png' },
  { id: 'dark', label: 'Dark', src: '/art/login/login-social-bg-dark.png' },
];

const fontOptions = [
  { label: 'Tech Mono', value: '"JetBrains Mono", "IBM Plex Sans Condensed", ui-monospace, monospace' },
  { label: 'Condensed', value: '"IBM Plex Sans Condensed", "Arial Narrow", ui-sans-serif, system-ui, sans-serif' },
  { label: 'Orbit', value: '"Orbitron", "JetBrains Mono", ui-monospace, monospace' },
  { label: 'Eurostile', value: '"Eurostile", "Microgramma", "Arial Narrow", ui-sans-serif, system-ui, sans-serif' },
  { label: 'Square', value: '"Rajdhani", "IBM Plex Sans Condensed", ui-sans-serif, system-ui, sans-serif' },
  { label: 'DIN', value: '"DIN Condensed", "Bahnschrift", "Arial Narrow", ui-sans-serif, system-ui, sans-serif' },
  { label: 'Bank', value: '"Bank Gothic", "Copperplate", "JetBrains Mono", ui-monospace, monospace' },
  { label: 'Wide', value: '"Arial Black", "Impact", ui-sans-serif, system-ui, sans-serif' },
  { label: 'System', value: 'ui-sans-serif, system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
] as const;

const defaultBrandText: BrandTextRecipe = {
  title: 'Cruel Company',
  fontFamily: fontOptions[0].value,
  align: 'center',
  titleSize: 28,
  x: 0,
  y: 0,
  letterSpacing: 26,
};

const defaultAuthLayout: AuthLayoutRecipe = {
  offsetY: 4,
  gap: 0,
};

const cloneBackdrop = (backdrop: BackdropRecipe): BackdropRecipe => ({ ...backdrop });
const cloneBrandText = (brand: BrandTextRecipe): BrandTextRecipe => ({ ...brand });
const cloneAuthLayout = (layout: AuthLayoutRecipe): AuthLayoutRecipe => ({ ...layout });

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
    goldWash: clamp(input.goldWash, defaultBackdrop.goldWash, 0, 100),
    darkWash: clamp(input.darkWash, defaultBackdrop.darkWash, 0, 100),
  };
};

const sanitizeBrandText = (value: unknown): BrandTextRecipe => {
  const input = typeof value === 'object' && value !== null ? value as Partial<BrandTextRecipe> : {};
  return {
    title: typeof input.title === 'string' && input.title.trim() ? input.title : defaultBrandText.title,
    fontFamily: typeof input.fontFamily === 'string' && fontOptions.some((option) => option.value === input.fontFamily)
      ? input.fontFamily
      : defaultBrandText.fontFamily,
    align: input.align === 'left' || input.align === 'right' || input.align === 'center' ? input.align : defaultBrandText.align,
    titleSize: clamp(input.titleSize, defaultBrandText.titleSize, 12, 42),
    x: clamp(input.x, defaultBrandText.x, -80, 80),
    y: clamp(input.y, defaultBrandText.y, -80, 80),
    letterSpacing: clamp(input.letterSpacing, defaultBrandText.letterSpacing, 0, 32),
  };
};

const sanitizeAuthLayout = (value: unknown): AuthLayoutRecipe => {
  const input = typeof value === 'object' && value !== null ? value as Partial<AuthLayoutRecipe> : {};
  return {
    offsetY: clamp(input.offsetY, defaultAuthLayout.offsetY, -6, 8),
    gap: clamp(input.gap, defaultAuthLayout.gap, 0, 20),
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

const BrandTextEditor = (props: { brand: BrandTextRecipe; onChange: (brand: BrandTextRecipe) => void }) => {
  const [fontPickerOpen, setFontPickerOpen] = createSignal(false);
  const update = <K extends keyof BrandTextRecipe>(key: K, value: BrandTextRecipe[K]) => {
    props.onChange({ ...props.brand, [key]: value });
  };

  return (
    <div class="ui-lab-control-group login-material-text-editor">
      <SectionLabel size="xs">Brand Text</SectionLabel>
      <div class="ui-lab-control-row">
        <span>Title</span>
        <input
          class="ui-lab-input login-material-text-input"
          value={props.brand.title}
          onInput={(event) => update('title', event.currentTarget.value)}
        />
      </div>
      <div class="ui-lab-control-row">
        <span>Font</span>
        <div class="login-material-font-control">
          <button type="button" class="ui-lab-mini-button" onClick={() => setFontPickerOpen(!fontPickerOpen())}>
            Tune Font
          </button>
          <Show when={fontPickerOpen()}>
            <div class="login-material-font-popover">
              <For each={fontOptions}>
                {(font) => (
                  <button
                    type="button"
                    class={`ui-lab-mini-button ${props.brand.fontFamily === font.value ? 'is-active' : ''}`}
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
        <span>Align</span>
        <div class="ui-lab-toggles">
          <MiniButton active={props.brand.align === 'left'} onClick={() => update('align', 'left')}>left</MiniButton>
          <MiniButton active={props.brand.align === 'center'} onClick={() => update('align', 'center')}>center</MiniButton>
          <MiniButton active={props.brand.align === 'right'} onClick={() => update('align', 'right')}>right</MiniButton>
        </div>
      </div>
      <div class="ui-lab-control-row">
        <span>Title Size</span>
        <Slider value={props.brand.titleSize} min={12} max={42} onInput={(value) => update('titleSize', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Tracking</span>
        <Slider value={props.brand.letterSpacing} min={0} max={32} onInput={(value) => update('letterSpacing', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>X</span>
        <Slider value={props.brand.x} min={-80} max={80} onInput={(value) => update('x', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Y</span>
        <Slider value={props.brand.y} min={-80} max={80} onInput={(value) => update('y', value)} />
      </div>
    </div>
  );
};

const AuthLayoutEditor = (props: { layout: AuthLayoutRecipe; onChange: (layout: AuthLayoutRecipe) => void }) => {
  const update = <K extends keyof AuthLayoutRecipe>(key: K, value: AuthLayoutRecipe[K]) => {
    props.onChange({ ...props.layout, [key]: value });
  };

  return (
    <div class="ui-lab-control-group login-material-layout-editor">
      <SectionLabel size="xs">Auth Layout</SectionLabel>
      <div class="ui-lab-control-row">
        <span>Y Offset</span>
        <Slider value={props.layout.offsetY} min={-6} max={8} onInput={(value) => update('offsetY', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Gap</span>
        <Slider value={props.layout.gap} min={0} max={20} onInput={(value) => update('gap', value)} />
      </div>
    </div>
  );
};

const BackdropRecipeEditor = (props: { backdrop: BackdropRecipe; onChange: (backdrop: BackdropRecipe) => void }) => {
  const update = <K extends keyof BackdropRecipe>(key: K, value: BackdropRecipe[K]) => {
    props.onChange({ ...props.backdrop, [key]: value });
  };

  return (
    <div class="ui-lab-control-group login-material-backdrop-editor">
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
        <span>Image Dim</span>
        <Slider value={props.backdrop.dim} min={0} max={80} onInput={(value) => update('dim', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Image Blur</span>
        <Slider value={props.backdrop.blur} min={0} max={18} onInput={(value) => update('blur', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Image Scale</span>
        <Slider value={props.backdrop.scale} min={100} max={130} onInput={(value) => update('scale', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Image X</span>
        <Slider value={props.backdrop.x} min={-120} max={120} onInput={(value) => update('x', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Image Y</span>
        <Slider value={props.backdrop.y} min={-120} max={120} onInput={(value) => update('y', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Gold Wash</span>
        <Slider value={props.backdrop.goldWash} onInput={(value) => update('goldWash', value)} />
      </div>
      <div class="ui-lab-control-row">
        <span>Dark Wash</span>
        <Slider value={props.backdrop.darkWash} onInput={(value) => update('darkWash', value)} />
      </div>
    </div>
  );
};

const GoogleSignInButton = () => (
  <div class="login-material-provider-button login-material-provider-button--google">
    <div class="g-signin2" data-onsuccess="onGoogleSignIn" />
    <span class="login-material-provider-fallback" aria-hidden="true">
      <span class="login-material-provider-preview-icon login-material-provider-preview-icon--google">G</span>
      <span>Sign in with Google</span>
    </span>
  </div>
);

const AppleSignInButton = () => (
  <div class="login-material-provider-button login-material-provider-button--apple">
    <div
      id="appleid-signin"
      data-color="black"
      data-border="true"
      data-border-radius="4"
      data-type="sign-in"
      data-mode="left-align"
      data-width="100%"
      data-height="44"
    />
    <span class="login-material-provider-fallback" aria-hidden="true">
      <span class="login-material-provider-preview-icon login-material-provider-preview-icon--apple">Apple</span>
      <span>Sign in with Apple</span>
    </span>
  </div>
);

const FacebookLoginButton = () => (
  <div class="login-material-provider-button login-material-provider-button--facebook">
    <div
      class="fb-login-button"
      data-size="large"
      data-button-type="continue_with"
      data-width="100%"
      data-scope="public_profile,email"
    />
    <span class="login-material-provider-fallback" aria-hidden="true">
      <span class="login-material-provider-preview-icon login-material-provider-preview-icon--facebook">f</span>
      <span>Continue with Facebook</span>
    </span>
  </div>
);

export const LoginMaterialPreviewScreen = () => {
  const [selectedPart, setSelectedPart] = createSignal<LoginPartId>('authPanel');
  const [backdrop, setBackdrop] = createSignal<BackdropRecipe>(cloneBackdrop(defaultBackdrop));
  const [brandText, setBrandText] = createSignal<BrandTextRecipe>(cloneBrandText(defaultBrandText));
  const [authLayout, setAuthLayout] = createSignal<AuthLayoutRecipe>(cloneAuthLayout(defaultAuthLayout));

  onMount(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        backdrop?: unknown;
        brandText?: unknown;
        authLayout?: unknown;
      };
      setBackdrop(sanitizeBackdrop(parsed.backdrop));
      const nextBrandText = sanitizeBrandText(parsed.brandText);
      setBrandText({
        ...nextBrandText,
        title: nextBrandText.title === 'Cruel Deal' ? defaultBrandText.title : nextBrandText.title,
      });
      setAuthLayout(sanitizeAuthLayout(parsed.authLayout));
    } catch {
      setBackdrop(cloneBackdrop(defaultBackdrop));
      setBrandText(cloneBrandText(defaultBrandText));
      setAuthLayout(cloneAuthLayout(defaultAuthLayout));
    }
  });

  createEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify({
      backdrop: backdrop(),
      brandText: brandText(),
      authLayout: authLayout(),
    }));
  });

  const resetSelected = () => {
    const part = selectedPart();
    if (part === 'backdrop') {
      setBackdrop(cloneBackdrop(defaultBackdrop));
      return;
    }
    if (part === 'brandPlate') {
      setBrandText(cloneBrandText(defaultBrandText));
      return;
    }
    if (part === 'authPanel') {
      setAuthLayout(cloneAuthLayout(defaultAuthLayout));
      return;
    }
  };

  const exportJson = () => {
    void navigator.clipboard?.writeText(JSON.stringify({
      backdrop: backdrop(),
      brandText: brandText(),
      authLayout: authLayout(),
    }, null, 2));
  };

  const selectedClass = (part: LoginPartId) => selectedPart() === part ? 'is-editing' : '';
  const selectedBackdropMode = () => backdropModes.find((mode) => mode.id === backdrop().mode) ?? backdropModes[0];
  const backdropStyle = () => ({
    '--login-bg-dim': `${backdrop().dim / 100}`,
    '--login-bg-blur': `${backdrop().blur}px`,
    '--login-bg-scale': `${backdrop().scale / 100}`,
    '--login-bg-x': `${backdrop().x}px`,
    '--login-bg-y': `${backdrop().y}px`,
    '--login-bg-gold': `${backdrop().goldWash / 100}`,
    '--login-bg-dark': `${backdrop().darkWash / 100}`,
  }) as JSX.CSSProperties;
  const brandStyle = () => ({
    '--login-brand-x': `${brandText().x}px`,
    '--login-brand-y': `${brandText().y}px`,
    '--login-brand-title-size': `${brandText().titleSize}px`,
    '--login-brand-tracking': `${brandText().letterSpacing / 100}em`,
    'font-family': brandText().fontFamily,
    'text-align': brandText().align,
  }) as JSX.CSSProperties;
  const authLayoutStyle = () => ({
    '--login-auth-offset-y': `${authLayout().offsetY}rem`,
    '--login-auth-gap': `${authLayout().gap}px`,
  }) as JSX.CSSProperties;

  const preview = (
    <div class={`login-material-phone login-material-phone--${selectedBackdropMode().id}`} style={backdropStyle()}>
      <img class={`login-material-bg ${selectedClass('backdrop')}`} src={selectedBackdropMode().src} alt="" />
      <div class="login-material-bg-wash" />

      <div class="login-material-content">
        <div class="login-material-auth-select" role="button" tabIndex={0} onClick={() => setSelectedPart('authPanel')}>
          <div class={`login-material-auth ${selectedClass('authPanel')}`} style={authLayoutStyle()}>
            <div class="login-material-form">
              <button class="login-material-selectable" type="button" onClick={(event) => {
                event.stopPropagation();
                setSelectedPart('brandPlate');
              }}>
                <div class={`login-material-brand ${selectedClass('brandPlate')}`} style={brandStyle()}>
                  <h1>{brandText().title}</h1>
                </div>
              </button>

              <div class="login-material-divider">
                <span />
                <strong>Login With</strong>
                <span />
              </div>

              <div class="login-material-social-row">
                <GoogleSignInButton />
                <AppleSignInButton />
                <FacebookLoginButton />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const editor = (
    <Show
      when={selectedPart() === 'backdrop'}
      fallback={(
        <Show
          when={selectedPart() === 'brandPlate'}
          fallback={(
            <Show
              when={selectedPart() === 'authPanel'}
              fallback={null}
            >
              <AuthLayoutEditor layout={authLayout()} onChange={setAuthLayout} />
            </Show>
          )}
        >
          <BrandTextEditor brand={brandText()} onChange={setBrandText} />
        </Show>
      )}
    >
      <BackdropRecipeEditor backdrop={backdrop()} onChange={setBackdrop} />
    </Show>
  );

  return (
    <MaterialWorkbenchLayout
      title="Login Skin"
      subtitle="Material Preview"
      parts={partLabels}
      selectedPartId={selectedPart()}
      onSelectPart={setSelectedPart}
      preview={preview}
      editor={editor}
      actions={<button type="button" class="ui-lab-mini-button" onClick={exportJson}>Export</button>}
      footer={(
        <>
          <button type="button" class="ui-lab-mini-button" onClick={resetSelected}>Reset Selected</button>
          <button type="button" onClick={() => {
            setBackdrop(cloneBackdrop(defaultBackdrop));
            setBrandText(cloneBrandText(defaultBrandText));
            setAuthLayout(cloneAuthLayout(defaultAuthLayout));
          }} class="ui-lab-mini-button">Reset All</button>
        </>
      )}
      class="login-material-page"
    />
  );
};

export default LoginMaterialPreviewScreen;
