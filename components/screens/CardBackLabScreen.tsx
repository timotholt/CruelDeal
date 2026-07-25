import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import {
  CardBackMaterial,
  DEFAULT_CARD_BACK_FONT,
  type CardBackFont,
  type CardBackMotion,
  type CardBackVariant,
} from '../game-surfaces/system/CardBackMaterial';
import {
  CARD_BACK_RUNTIME_HEIGHT,
  CARD_BACK_RUNTIME_WIDTH,
  createRuntimeCardBackDataUrl,
  downloadRuntimeCardBackWebp,
} from '../game-surfaces/system/card-backs/cardBackExport';
import { CARD_BACK_FONT_OPTIONS } from '../game-surfaces/system/card-backs/cardBackTypeface';
import { ReferenceCardBackMaterial } from '../game-surfaces/system/card-backs/ReferenceCardBackMaterial';
import { enableGyro, gyroActive } from '../ui/shiny';
import '../../src/styles/card-back-lab.css';
import type { CardBackLayerVisibility } from '../game-surfaces/system/card-backs/cardBackTypes';
import type { CardBackLight } from '../game-surfaces/system/card-backs/cardBackTypes';
import type { CardBackRelief } from '../game-surfaces/system/card-backs/cardBackTypes';
import type { CardBackTypography } from '../game-surfaces/system/card-backs/cardBackTypes';
import {
  CARD_BACK_LAB_FAVORITE_DEFAULTS,
  CARD_BACK_LAB_SHARP_FONT,
  CARD_BACK_LAB_SHARP_FONT_URL,
} from './cardBackLabDefaults';

interface BrowserLocalFontData {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
  blob: () => Promise<Blob>;
}

interface LocalFontOption {
  id: CardBackFont;
  label: string;
  buffer: () => Promise<ArrayBuffer>;
}

const variants: CardBackVariant[] = ['onyx', 'ivory'];
const motionModes: CardBackMotion[] = ['dynamic', 'static', 'off'];
const layerOptions: Array<{ id: keyof CardBackLayerVisibility; label: string; detail: string }> = [
  { id: 'substrate', label: 'Substrate', detail: 'Uninterrupted LLM-generated material texture' },
  { id: 'grooves', label: 'Groove relief', detail: 'Algorithmic recess built from the canonical paths' },
  { id: 'structuralGold', label: 'Gold rails', detail: 'Groove-registered vector rails plus edge perimeter' },
  { id: 'identity', label: 'Identity', detail: 'Editable emblem, caption, micro type, and corner discs' },
  { id: 'finish', label: 'Gold finish', detail: 'Restrained static metallic response' },
  { id: 'keyLight', label: 'Key light', detail: 'Upper-right studio illumination' },
  { id: 'reflection', label: 'Reflection', detail: 'Gold-only pointer and device response' },
];
const lightControls: Array<{
  id: Exclude<keyof CardBackLight, 'color'>;
  label: string;
  min: number;
  max: number;
  step: number;
}> = [
  { id: 'ambient', label: 'Ambient brightness', min: 0.15, max: 1.2, step: 0.01 },
  { id: 'x', label: 'Position X', min: -0.25, max: 1.25, step: 0.01 },
  { id: 'y', label: 'Position Y', min: -0.25, max: 1.25, step: 0.01 },
  { id: 'height', label: 'Height', min: 0.1, max: 1.5, step: 0.01 },
  { id: 'intensity', label: 'Intensity', min: 0, max: 2.5, step: 0.01 },
  { id: 'falloff', label: 'Light falloff', min: 0.5, max: 20, step: 0.1 },
  { id: 'shadowSoftness', label: 'Shadow softness', min: 0.5, max: 20, step: 0.1 },
];
const reliefControls: Array<{
  id: keyof CardBackRelief;
  label: string;
  min: number;
  max: number;
  step: number;
}> = [
  { id: 'outerBorderWidth', label: 'Outer border width', min: 8, max: 48, step: 1 },
  { id: 'railWidth', label: 'Rail width', min: 6, max: 36, step: 1 },
  { id: 'hexWidth', label: 'Hex line width', min: 6, max: 52, step: 1 },
  { id: 'grooveWidth', label: 'Groove margin', min: 4, max: 50, step: 1 },
  { id: 'bevelSoftness', label: 'Bevel width', min: 1, max: 16, step: 0.5 },
  { id: 'goldHeight', label: 'Gold height', min: 0.02, max: 0.2, step: 0.005 },
  { id: 'hexHeight', label: 'Hex raised height', min: 0.02, max: 0.4, step: 0.005 },
  { id: 'identityHeight', label: 'Identity height', min: 0.02, max: 0.3, step: 0.005 },
  { id: 'grooveDepth', label: 'Groove depth', min: 0.01, max: 0.15, step: 0.005 },
  { id: 'curveRadius', label: 'Rail curve radius', min: 0, max: 90, step: 1 },
];
const typographyControls: Array<{
  id: keyof CardBackTypography['caption'];
  label: string;
  min: number;
  max: number;
  step: number;
}> = [
  { id: 'size', label: 'Font size', min: 24, max: 320, step: 1 },
  { id: 'spacing', label: 'Letter spacing', min: -30, max: 100, step: 1 },
  { id: 'x', label: 'Position X', min: -300, max: 300, step: 1 },
  { id: 'y', label: 'Position Y', min: -300, max: 300, step: 1 },
];

interface CardBackLabSettings {
  version: 2;
  variant: CardBackVariant;
  font: CardBackFont;
  emblemFont: CardBackFont;
  motion: CardBackMotion;
  showMask: boolean;
  caption: string;
  emblem: string;
  microTextA: string;
  microTextB: string;
  layers: CardBackLayerVisibility;
  light: CardBackLight;
  relief: CardBackRelief;
  typography: CardBackTypography;
}

const CARD_BACK_LAB_SETTINGS_KEY = 'cruel-deal.card-back-lab.settings.v2';

const bundledSharpFontOption: LocalFontOption = {
  id: CARD_BACK_LAB_SHARP_FONT,
  label: 'Sharp — Regular',
  buffer: async () => {
    const response = await fetch(CARD_BACK_LAB_SHARP_FONT_URL);
    if (!response.ok) throw new Error(`Sharp font request failed (${response.status})`);
    return response.arrayBuffer();
  },
};

const loadCardBackLabSettings = (): CardBackLabSettings | null => {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(CARD_BACK_LAB_SETTINGS_KEY) ?? 'null') as CardBackLabSettings | null;
    return value?.version === 2 ? value : null;
  } catch {
    return null;
  }
};

const saveCardBackLabSettings = (settings: CardBackLabSettings) => {
  try {
    window.localStorage.setItem(CARD_BACK_LAB_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // The authoring tool remains usable when storage is disabled or full.
  }
};

export const CardBackLabScreen = () => {
  const savedSettings = loadCardBackLabSettings();
  const savedFont = savedSettings?.font ?? CARD_BACK_LAB_FAVORITE_DEFAULTS.font;
  const savedEmblemFont = savedSettings?.emblemFont ?? CARD_BACK_LAB_FAVORITE_DEFAULTS.emblemFont;
  const [variant, setVariant] = createSignal<CardBackVariant>(savedSettings?.variant ?? CARD_BACK_LAB_FAVORITE_DEFAULTS.variant);
  const [font, setFont] = createSignal<CardBackFont>(savedFont.startsWith('local:') ? DEFAULT_CARD_BACK_FONT : savedFont);
  const [fontPreference, setFontPreference] = createSignal<CardBackFont>(savedFont);
  const [emblemFont, setEmblemFont] = createSignal<CardBackFont>(savedEmblemFont.startsWith('local:') ? DEFAULT_CARD_BACK_FONT : savedEmblemFont);
  const [emblemFontPreference, setEmblemFontPreference] = createSignal<CardBackFont>(savedEmblemFont);
  const [localFontOptions, setLocalFontOptions] = createSignal<LocalFontOption[]>([bundledSharpFontOption]);
  const [localFontMessage, setLocalFontMessage] = createSignal(
    (savedFont.startsWith('local:') && savedFont !== CARD_BACK_LAB_SHARP_FONT)
      || (savedEmblemFont.startsWith('local:') && savedEmblemFont !== CARD_BACK_LAB_SHARP_FONT)
      ? 'Saved local typeface: click Load installed fonts or re-import the font file to restore it.'
      : '',
  );
  const [motion, setMotion] = createSignal<CardBackMotion>(savedSettings?.motion ?? CARD_BACK_LAB_FAVORITE_DEFAULTS.motion);
  const [showMask, setShowMask] = createSignal(savedSettings?.showMask ?? CARD_BACK_LAB_FAVORITE_DEFAULTS.showMask);
  const [gyroDenied, setGyroDenied] = createSignal(false);
  const [caption, setCaption] = createSignal<string>(savedSettings?.caption ?? CARD_BACK_LAB_FAVORITE_DEFAULTS.caption);
  const [emblem, setEmblem] = createSignal<string>(savedSettings?.emblem ?? CARD_BACK_LAB_FAVORITE_DEFAULTS.emblem);
  const [microTextA, setMicroTextA] = createSignal<string>(savedSettings?.microTextA ?? CARD_BACK_LAB_FAVORITE_DEFAULTS.microTextA);
  const [microTextB, setMicroTextB] = createSignal<string>(savedSettings?.microTextB ?? CARD_BACK_LAB_FAVORITE_DEFAULTS.microTextB);
  const [exporting, setExporting] = createSignal(false);
  const [exportMessage, setExportMessage] = createSignal<string | null>(null);
  const [layers, setLayers] = createSignal<CardBackLayerVisibility>({ ...CARD_BACK_LAB_FAVORITE_DEFAULTS.layers, ...savedSettings?.layers });
  const [light, setLight] = createSignal<CardBackLight>({ ...CARD_BACK_LAB_FAVORITE_DEFAULTS.light, ...savedSettings?.light });
  const [relief, setRelief] = createSignal<CardBackRelief>({ ...CARD_BACK_LAB_FAVORITE_DEFAULTS.relief, ...savedSettings?.relief });
  const [typography, setTypography] = createSignal<CardBackTypography>({
    caption: { ...CARD_BACK_LAB_FAVORITE_DEFAULTS.typography.caption, ...savedSettings?.typography?.caption },
    emblem: { ...CARD_BACK_LAB_FAVORITE_DEFAULTS.typography.emblem, ...savedSettings?.typography?.emblem },
  });
  const [lightGuideVisible, setLightGuideVisible] = createSignal(false);
  let lightGuideTimer: number | undefined;
  let rebuildHost: HTMLDivElement | undefined;
  const loadedLocalFonts = new Set<CardBackFont>();

  const addLocalFontOptions = (options: LocalFontOption[]) => {
    setLocalFontOptions(current => {
      const merged = new Map(current.map(option => [option.id, option]));
      options.forEach(option => merged.set(option.id, option));
      return [...merged.values()].sort((a, b) => a.label.localeCompare(b.label));
    });
  };

  const discoverLocalFonts = async () => {
    const queryLocalFonts = (window as Window & {
      queryLocalFonts?: () => Promise<BrowserLocalFontData[]>;
    }).queryLocalFonts;
    if (!queryLocalFonts) {
      setLocalFontMessage('Installed-font access is unavailable here. Use Import font files.');
      return;
    }
    setLocalFontMessage('Requesting installed-font access…');
    try {
      const records = await queryLocalFonts.call(window);
      const unique = new Map<string, BrowserLocalFontData>();
      records.forEach(record => unique.set(record.postscriptName, record));
      addLocalFontOptions([...unique.values()].map(record => ({
        id: `local:${record.postscriptName}` as CardBackFont,
        label: `${record.family} — ${record.style}`,
        buffer: async () => (await record.blob()).arrayBuffer(),
      })));
      setLocalFontMessage(
        unique.size > 0
          ? `${unique.size} installed font faces available.`
          : 'No installed fonts were exposed by this browser. Use Import font files or open the foundry in Chrome.',
      );
      await restorePreferredLocalFonts();
    } catch (error) {
      const denied = error instanceof DOMException && error.name === 'NotAllowedError';
      setLocalFontMessage(denied
        ? 'Local-font permission was declined. Use Import font files or enable Local fonts for this site.'
        : `Could not read installed fonts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const selectTypeface = async (
    selected: CardBackFont,
    setter: (value: CardBackFont) => void,
    preferenceSetter: (value: CardBackFont) => void,
  ) => {
    preferenceSetter(selected);
    if (!selected.startsWith('local:') || loadedLocalFonts.has(selected)) {
      setter(selected);
      return;
    }
    const option = localFontOptions().find(candidate => candidate.id === selected);
    if (!option) return;
    setLocalFontMessage(`Loading ${option.label}…`);
    try {
      const { loadLocalCardBackFont } = await import('../game-surfaces/system/card-backs/localCardBackFont');
      loadLocalCardBackFont(selected, await option.buffer());
      loadedLocalFonts.add(selected);
      setter(selected);
      setLocalFontMessage(`${option.label} is ready for 3D extrusion.`);
    } catch (error) {
      setLocalFontMessage(`Could not parse ${option.label}: ${error instanceof Error ? error.message : 'Unsupported font'}`);
    }
  };

  async function restorePreferredLocalFonts() {
    const pending = [
      selectTypeface(fontPreference(), setFont, setFontPreference),
      selectTypeface(emblemFontPreference(), setEmblemFont, setEmblemFontPreference),
    ];
    await Promise.all(pending);
  }

  onMount(() => {
    void restorePreferredLocalFonts();
  });

  const importFontFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setLocalFontMessage(`Importing ${files.length} font file${files.length === 1 ? '' : 's'}…`);
    const { loadLocalCardBackFont } = await import('../game-surfaces/system/card-backs/localCardBackFont');
    const imported: LocalFontOption[] = [];
    let failures = 0;
    for (const file of Array.from(files)) {
      const id = `local:file:${file.name}:${file.size}:${file.lastModified}` as CardBackFont;
      try {
        const buffer = await file.arrayBuffer();
        const metadata = loadLocalCardBackFont(id, buffer);
        loadedLocalFonts.add(id);
        imported.push({
          id,
          label: `${metadata.family} — ${metadata.style}`,
          buffer: async () => buffer,
        });
      } catch {
        failures += 1;
      }
    }
    addLocalFontOptions(imported);
    await restorePreferredLocalFonts();
    setLocalFontMessage(`${imported.length} font${imported.length === 1 ? '' : 's'} imported${failures ? `; ${failures} unsupported` : ''}.`);
  };

  createEffect(() => {
    const settings: CardBackLabSettings = {
      version: 2,
      variant: variant(),
      font: fontPreference(),
      emblemFont: emblemFontPreference(),
      motion: motion(),
      showMask: showMask(),
      caption: caption(),
      emblem: emblem(),
      microTextA: microTextA(),
      microTextB: microTextB(),
      layers: layers(),
      light: light(),
      relief: relief(),
      typography: typography(),
    };
    saveCardBackLabSettings(settings);
  });

  const requestGyro = async () => {
    const enabled = await enableGyro();
    setGyroDenied(!enabled);
  };

  const toggleLayer = (layer: keyof CardBackLayerVisibility) => {
    setLayers(current => ({ ...current, [layer]: !current[layer] }));
  };

  const revealLightGuide = () => {
    setLightGuideVisible(true);
    if (lightGuideTimer !== undefined) window.clearTimeout(lightGuideTimer);
    lightGuideTimer = window.setTimeout(() => setLightGuideVisible(false), 2000);
  };

  const setLightValue = (property: Exclude<keyof CardBackLight, 'color'>, value: number) => {
    setLight(current => ({ ...current, [property]: value }));
    revealLightGuide();
  };

  onCleanup(() => {
    if (lightGuideTimer !== undefined) window.clearTimeout(lightGuideTimer);
  });

  const setReliefValue = (property: keyof CardBackRelief, value: number) => {
    setRelief(current => ({ ...current, [property]: value }));
  };

  const setTypographyValue = (
    target: keyof CardBackTypography,
    property: keyof CardBackTypography['caption'],
    value: number,
  ) => {
    setTypography(current => ({
      ...current,
      [target]: { ...current[target], [property]: value },
    }));
  };

  const renderedCanvas = () => {
    const canvas = rebuildHost?.querySelector<HTMLCanvasElement>('[data-card-back-three]');
    const material = rebuildHost?.querySelector<HTMLElement>('.card-back-material');
    if (!canvas || material?.dataset.threeReady !== 'true') {
      throw new Error('The authoring renderer is not ready yet.');
    }
    return canvas;
  };

  const exportWebp = async () => {
    if (exporting()) return;
    setExporting(true);
    setExportMessage(null);
    try {
      await downloadRuntimeCardBackWebp(renderedCanvas(), `cruel-company-card-back-${variant()}-${CARD_BACK_RUNTIME_WIDTH}x${CARD_BACK_RUNTIME_HEIGHT}.webp`);
      setExportMessage(`Downloaded ${CARD_BACK_RUNTIME_WIDTH}x${CARD_BACK_RUNTIME_HEIGHT} WebP.`);
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setExporting(false);
    }
  };

  const saveCandidate = async () => {
    if (exporting()) return;
    setExporting(true);
    setExportMessage(null);
    try {
      const response = await fetch('/api/assets/author-card-back', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          dataUrl: await createRuntimeCardBackDataUrl(renderedCanvas()),
          displayName: `Cruel Company Card Back (${variant()})`,
          committedSize: { w: CARD_BACK_RUNTIME_WIDTH, h: CARD_BACK_RUNTIME_HEIGHT },
          engineTargetPath: '/art/cards/backs/default.webp',
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || `Asset Foundry rejected the render (${response.status}).`);
      setExportMessage('Saved as a review candidate. Approve and promote it from Asset Foundry.');
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <main class="card-back-lab" data-show-mask={showMask()}>
      <header class="card-back-lab__toolbar">
        <div>
          <span>Material proof 04</span>
          <h1>Card Back Optics</h1>
          <a href="/tools/asset-foundry/">Back to Asset Foundry</a>
        </div>

        <div class="card-back-lab__controls">
          <div class="card-back-lab__segments" aria-label="Card-back color">
            <For each={variants}>{item => (
              <button classList={{ active: variant() === item }} onClick={() => setVariant(item)}>{item}</button>
            )}</For>
          </div>
          <div class="card-back-lab__segments" aria-label="Reflection quality">
            <For each={motionModes}>{item => (
              <button classList={{ active: motion() === item }} onClick={() => setMotion(item)}>{item}</button>
            )}</For>
          </div>
          <label class="card-back-lab__toggle">
            <input type="checkbox" checked={showMask()} onInput={event => setShowMask(event.currentTarget.checked)} />
            Mask
          </label>
          <button class="card-back-lab__command" disabled={gyroActive()} onClick={() => void requestGyro()}>
            {gyroActive() ? 'Tilt active' : 'Enable tilt'}
          </button>
        </div>
      </header>

      <Show when={gyroDenied()}>
        <div class="card-back-lab__notice">Device orientation is unavailable or permission was declined.</div>
      </Show>

      <section class="card-back-lab__stage">
        <div class="card-back-lab__comparison">
          <figure class="card-back-lab__reference">
            <figcaption><span>Reference</span><strong>Original · 540:887</strong></figcaption>
            <div class="card-back-lab__reference-card">
              <ReferenceCardBackMaterial motion={motion()} />
            </div>
          </figure>
          <figure class="card-back-lab__rebuild">
            <figcaption><span>Reconstruction</span><strong>Native · 5:7</strong></figcaption>
            <div ref={element => { rebuildHost = element; }} class="card-back-lab__rebuild-card">
              <CardBackMaterial
                variant={variant()}
                font={font()}
                emblemFont={emblemFont()}
                motion={motion()}
                caption={caption()}
                emblem={emblem()}
                microTextA={microTextA()}
                microTextB={microTextB()}
                layers={layers()}
                light={light()}
                relief={relief()}
                typography={typography()}
              />
              <Show when={lightGuideVisible()}>
                <div
                  class="card-back-lab__light-guide"
                  style={{
                    left: `${light().x * 100}%`,
                    top: `${light().y * 100}%`,
                    color: light().color,
                  }}
                >
                  <i />
                  <output>KEY · Z {light().height.toFixed(2)}</output>
                </div>
              </Show>
            </div>
          </figure>
        </div>
        <aside class="card-back-lab__editor">
          <header>
            <span>Cruel Company / master 01</span>
            <strong>Generated material rebuild</strong>
          </header>
          <label>
            <span>Caption</span>
            <input
              value={caption()}
              maxlength="10"
              spellcheck={false}
              onInput={event => setCaption(event.currentTarget.value)}
            />
          </label>
          <label>
            <span>Caption typeface</span>
            <select
              aria-label="Caption typeface"
              value={fontPreference()}
              onInput={event => void selectTypeface(event.currentTarget.value as CardBackFont, setFont, setFontPreference)}
            >
              <For each={CARD_BACK_FONT_OPTIONS}>{option => (
                <option value={option.id}>{option.label}</option>
              )}</For>
              <Show when={localFontOptions().length > 0}>
                <optgroup label="Installed and imported fonts">
                  <For each={localFontOptions()}>{option => (
                    <option value={option.id}>{option.label}</option>
                  )}</For>
                </optgroup>
              </Show>
            </select>
          </label>
          <label>
            <span>Center emblem</span>
            <input
              value={emblem()}
              maxlength="4"
              spellcheck={false}
              onInput={event => setEmblem(event.currentTarget.value)}
            />
          </label>
          <label>
            <span>Emblem typeface</span>
            <select
              aria-label="Emblem typeface"
              value={emblemFontPreference()}
              onInput={event => void selectTypeface(event.currentTarget.value as CardBackFont, setEmblemFont, setEmblemFontPreference)}
            >
              <For each={CARD_BACK_FONT_OPTIONS}>{option => (
                <option value={option.id}>{option.label}</option>
              )}</For>
              <Show when={localFontOptions().length > 0}>
                <optgroup label="Installed and imported fonts">
                  <For each={localFontOptions()}>{option => (
                    <option value={option.id}>{option.label}</option>
                  )}</For>
                </optgroup>
              </Show>
            </select>
          </label>
          <div class="card-back-lab__font-tools">
            <button type="button" onClick={() => void discoverLocalFonts()}>Load installed fonts</button>
            <label>
              <span>Import font files</span>
              <input
                aria-label="Import font files"
                type="file"
                accept=".otf,.ttf,.ttc,.woff,.woff2,font/otf,font/ttf"
                multiple
                onChange={event => {
                  void importFontFiles(event.currentTarget.files);
                  event.currentTarget.value = '';
                }}
              />
            </label>
            <Show when={localFontMessage()}>{message => <small>{message()}</small>}</Show>
          </div>
          <section class="card-back-lab__typography-controls" aria-label="Typography placement controls">
            <header>
              <span>Type layout</span>
              <button type="button" onClick={() => setTypography({
                caption: { ...CARD_BACK_LAB_FAVORITE_DEFAULTS.typography.caption },
                emblem: { ...CARD_BACK_LAB_FAVORITE_DEFAULTS.typography.emblem },
              })}>Reset type</button>
            </header>
            <For each={(['caption', 'emblem'] as const)}>{target => (
              <fieldset>
                <legend>{target === 'caption' ? 'Caption' : 'Center emblem'}</legend>
                <For each={typographyControls}>{control => (
                  <label>
                    <span>{control.label}</span>
                    <output>{typography()[target][control.id].toFixed(0)}</output>
                    <input
                      aria-label={`${target === 'caption' ? 'Caption' : 'Emblem'} ${control.label}`}
                      type="range"
                      min={control.min}
                      max={control.max}
                      step={control.step}
                      value={typography()[target][control.id]}
                      onInput={event => setTypographyValue(target, control.id, Number(event.currentTarget.value))}
                    />
                  </label>
                )}</For>
              </fieldset>
            )}</For>
          </section>
          <label>
            <span>Micro text A</span>
            <input
              value={microTextA()}
              maxlength="38"
              spellcheck={false}
              onInput={event => setMicroTextA(event.currentTarget.value)}
            />
          </label>
          <label>
            <span>Micro text B</span>
            <input
              value={microTextB()}
              maxlength="38"
              spellcheck={false}
              onInput={event => setMicroTextB(event.currentTarget.value)}
            />
          </label>
          <div class="card-back-lab__exports">
            <button type="button" disabled={exporting()} onClick={() => void exportWebp()}>Download WebP</button>
            <button type="button" disabled={exporting()} onClick={() => void saveCandidate()}>
              {exporting() ? 'Rendering' : 'Save candidate'}
            </button>
          </div>
          <Show when={exportMessage()}>{message => (
            <div class="card-back-lab__export-message">{message()}</div>
          )}</Show>
          <div class="card-back-lab__runtime-contract">
            <strong>Game output</strong>
            <span>{CARD_BACK_RUNTIME_WIDTH}×{CARD_BACK_RUNTIME_HEIGHT} · 5:7 · WebP</span>
            <small>All static material, relief, identity, and fixed lighting are flattened. Reflection remains runtime-owned.</small>
          </div>
          <div class="card-back-lab__light-controls" aria-label="Three.js key light controls">
            <header>
              <span>Three.js studio light</span>
              <button type="button" onClick={() => setLight({ ...CARD_BACK_LAB_FAVORITE_DEFAULTS.light })}>Reset light</button>
            </header>
            <label>
              <span>Light color</span>
              <output>{light().color.toUpperCase()}</output>
              <input
                aria-label="Light color"
                type="color"
                value={light().color}
                onInput={event => {
                  setLight(current => ({ ...current, color: event.currentTarget.value }));
                  revealLightGuide();
                }}
              />
            </label>
            <For each={lightControls}>{control => (
              <label>
                <span>{control.label}</span>
                <output>{light()[control.id].toFixed(control.id === 'falloff' || control.id === 'shadowSoftness' ? 1 : 2)}</output>
                <input
                  aria-label={control.label}
                  type="range"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={light()[control.id]}
                  onInput={event => setLightValue(control.id, event.currentTarget.valueAsNumber)}
                />
              </label>
            )}</For>
          </div>
          <div class="card-back-lab__light-controls" aria-label="Three.js geometry controls">
            <header>
              <span>Three.js geometry</span>
              <button type="button" onClick={() => setRelief({ ...CARD_BACK_LAB_FAVORITE_DEFAULTS.relief })}>Reset relief</button>
            </header>
            <For each={reliefControls}>{control => (
              <label>
                <span>{control.label}</span>
                <output>{relief()[control.id].toFixed(control.step < 0.01 ? 3 : control.step < 1 ? 2 : 0)}</output>
                <input
                  aria-label={control.label}
                  type="range"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={relief()[control.id]}
                  onInput={event => setReliefValue(control.id, event.currentTarget.valueAsNumber)}
                />
              </label>
            )}</For>
          </div>
          <div class="card-back-lab__layer-list" aria-label="Card-back layer visibility">
            <header>Layers</header>
            <For each={layerOptions}>{(layer, index) => (
              <label>
                <input
                  aria-label={layer.label}
                  type="checkbox"
                  checked={layers()[layer.id]}
                  onInput={() => toggleLayer(layer.id)}
                />
                <span>{String(index() + 1).padStart(2, '0')}</span>
                <strong>{layer.label}</strong>
                <small>{layer.detail}</small>
              </label>
            )}</For>
          </div>
        </aside>
      </section>

      <section class="card-back-lab__scale-proof">
        <header><span>Gameplay proof</span><strong>Same component, production scales</strong></header>
        <div class="card-back-lab__scale-row">
          <For each={[58, 74, 104, 148]}>{width => (
            <figure style={{ width: `${width}px` }}>
              <CardBackMaterial
                renderSurface={false}
                variant={variant()}
                font={font()}
                emblemFont={emblemFont()}
                motion={motion()}
                caption={caption()}
                emblem={emblem()}
                microTextA={microTextA()}
                microTextB={microTextB()}
                layers={layers()}
                light={light()}
                relief={relief()}
                typography={typography()}
              />
              <figcaption>{width}px</figcaption>
            </figure>
          )}</For>
        </div>
      </section>

    </main>
  );
};
