import { createEffect, createMemo, createSignal, For } from 'solid-js';
import { GameText } from '../ui/GameText';
import { GameTextV2, type GameTextV2FitMode } from '../ui/GameTextV2';
import '../../src/styles/gametext-test.css';

type GameTextAlign = 'left' | 'center' | 'right';
type GameTextVerticalAlign = 'top' | 'center' | 'bottom';
type TypographyVariantId = 'normal' | 'bold' | 'italic' | 'bold-italic';
type FitFilterId = GameTextV2FitMode;
type LanguageFilterId = 'latin' | 'japanese' | 'chinese' | 'korean' | 'arabic' | 'mixed';

interface GameTextCase {
  id: string;
  label: string;
  text: string;
  section?: 'core' | 'international';
  kind?: 'plain' | 'button' | 'badge' | 'danger';
  width: number;
  height: number;
  insetX?: number;
  insetY?: number;
  insetTop?: number;
  insetRight?: number;
  insetBottom?: number;
  insetLeft?: number;
  baseFontSize: number;
  minScale?: number;
  maxScale?: number;
  maxLines?: number;
  align?: GameTextAlign;
  verticalAlign?: GameTextVerticalAlign;
  italic?: boolean;
  letterSpacing?: string;
  fontFamily?: string;
  fontWeight?: number | string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  lineHeight?: number;
  fitMode?: GameTextV2FitMode;
  lang?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  typographyVariant?: TypographyVariantId;
}

interface GameTextAuditResult {
  id: string;
  passed: boolean;
  scale: number;
  overflowX: number;
  overflowY: number;
  centerDeltaX: number | null;
  centerDeltaY: number | null;
  failures: string[];
}

interface GameTextAuditSummary {
  passed: number;
  failed: number;
  total: number;
  results: GameTextAuditResult[];
}

declare global {
  interface Window {
    __gameTextAudit?: () => Promise<GameTextAuditSummary>;
    __gameTextAuditResults?: GameTextAuditSummary;
    __gameTextV2Audit?: () => Promise<GameTextAuditSummary>;
    __gameTextV2AuditResults?: GameTextAuditSummary;
  }
}

const coreCases: GameTextCase[] = [
  { id: 'tiny-log', label: 'Tiny command', text: 'LOG', kind: 'button', width: 42, height: 24, baseFontSize: 0.78, maxScale: 1, minScale: 0.5, italic: true },
  { id: 'tiny-count', label: 'Tiny number', text: '10', kind: 'button', width: 38, height: 24, baseFontSize: 0.8, maxScale: 1, minScale: 0.55, italic: true },
  { id: 'cta-normal', label: 'CTA normal', text: 'VIEW CONTRACT', kind: 'button', width: 104, height: 28, insetX: 8, insetY: 5, baseFontSize: 0.72, maxScale: 1, minScale: 0.48, italic: false },
  { id: 'cta-long', label: 'CTA long', text: 'AUTHORIZE CONTRACT TRANSFER', kind: 'button', width: 112, height: 28, insetX: 8, insetY: 5, baseFontSize: 0.72, maxScale: 1, minScale: 0.34, italic: false },
  { id: 'toolbar-two-line', label: 'Two-line command', text: 'PLAY\nCONQUEST', kind: 'button', width: 70, height: 34, insetX: 6, insetY: 4, baseFontSize: 0.66, maxLines: 2, minScale: 0.5, italic: true, lineHeight: 0.9 },
  { id: 'toolbar-long-two-line', label: 'Two-line squeeze', text: 'TACTICAL\nCONQUEST RUN', kind: 'button', width: 70, height: 34, insetX: 6, insetY: 4, baseFontSize: 0.66, maxLines: 2, minScale: 0.35, italic: true, lineHeight: 0.9 },
  { id: 'nav-battle-pass', label: 'Nav label', text: 'BATTLE PASS', kind: 'button', width: 74, height: 30, insetX: 4, insetY: 3, baseFontSize: 0.58, maxScale: 1, minScale: 0.5, italic: false },
  { id: 'nav-localized', label: 'Nav localized', text: 'COMMUNICATIONS', kind: 'button', width: 74, height: 30, insetX: 4, insetY: 3, baseFontSize: 0.58, minScale: 0.34, italic: false },
  { id: 'currency-short', label: 'Currency short', text: '500', kind: 'button', width: 45, height: 25, insetX: 5, insetY: 4, baseFontSize: 0.62, minScale: 0.55, italic: true },
  { id: 'currency-long', label: 'Currency long', text: '125000', kind: 'button', width: 52, height: 25, insetX: 5, insetY: 4, baseFontSize: 0.62, minScale: 0.35, italic: true },
  { id: 'badge-days', label: 'Deadline badge', text: '03 DAYS LEFT', kind: 'badge', width: 104, height: 22, insetX: 10, insetY: 4, baseFontSize: 0.58, minScale: 0.45, italic: false },
  { id: 'badge-urgent', label: 'Urgent badge', text: 'EXPIRES IN 00:12:59', kind: 'badge', width: 104, height: 22, insetX: 10, insetY: 4, baseFontSize: 0.58, minScale: 0.32, italic: false },
  { id: 'left-title', label: 'Left aligned', text: 'DATA EXTRACTION', width: 124, height: 34, baseFontSize: 0.92, minScale: 0.46, align: 'left', italic: false },
  { id: 'right-meta', label: 'Right aligned', text: 'SECTOR 07', width: 86, height: 22, baseFontSize: 0.62, minScale: 0.5, align: 'right', italic: false },
  { id: 'top-left', label: 'Top left', text: 'PATCH NOTES', width: 130, height: 48, baseFontSize: 0.62, align: 'left', verticalAlign: 'top', italic: false },
  { id: 'bottom-right', label: 'Bottom right', text: 'UPDATE 1.4.0', width: 130, height: 48, baseFontSize: 0.62, align: 'right', verticalAlign: 'bottom', italic: false },
  { id: 'multiline-brief', label: 'Multiline body', text: 'Extract encrypted data\nfrom Solace Corp\nmainframe cluster.', width: 122, height: 62, insetX: 4, insetY: 4, baseFontSize: 0.56, maxLines: 3, minScale: 0.52, align: 'left', italic: false, textTransform: 'none', lineHeight: 1.08 },
  { id: 'multiline-center', label: 'Centered body', text: 'Navigation rebuilt\naround faster command\nchoices.', width: 138, height: 56, insetX: 6, insetY: 4, baseFontSize: 0.58, maxLines: 3, minScale: 0.45, align: 'center', italic: false, textTransform: 'none', lineHeight: 1.06 },
  { id: 'multiline-tall', label: 'Tall multiline', text: 'One\nTwo\nThree\nFour', width: 72, height: 70, insetX: 4, insetY: 4, baseFontSize: 0.62, maxLines: 4, minScale: 0.44, italic: false, lineHeight: 1 },
  { id: 'no-uppercase', label: 'No transform', text: 'Mixed Case Label', width: 122, height: 28, baseFontSize: 0.66, minScale: 0.48, italic: false, textTransform: 'none' },
  { id: 'capitalize', label: 'Capitalize', text: 'market exchange', width: 118, height: 28, baseFontSize: 0.66, minScale: 0.48, italic: false, textTransform: 'capitalize' },
  { id: 'wide-headline', label: 'Wide headline', text: 'SPATIAL UI', width: 180, height: 44, baseFontSize: 1.35, minScale: 0.5, italic: false, fontWeight: 900 },
  { id: 'narrow-headline', label: 'Narrow headline', text: 'SPATIAL UI', width: 92, height: 44, baseFontSize: 1.35, minScale: 0.34, italic: false, fontWeight: 900 },
  { id: 'regular-weight', label: 'Regular weight', text: 'Mission Loaded', width: 118, height: 30, baseFontSize: 0.72, minScale: 0.5, italic: false, fontWeight: 600, textTransform: 'none' },
  { id: 'heavy-italic', label: 'Heavy italic', text: 'COMMANDER', width: 110, height: 29, baseFontSize: 0.82, minScale: 0.56, italic: true, fontWeight: 900 },
  { id: 'sans-family', label: 'Sans family', text: 'Top Decks', width: 96, height: 28, baseFontSize: 0.64, minScale: 0.48, italic: false, fontFamily: '"IBM Plex Sans", sans-serif', fontWeight: 700, textTransform: 'capitalize' },
  { id: 'mono-family', label: 'Mono-like', text: '12 DECKS LIVE', width: 98, height: 26, baseFontSize: 0.56, minScale: 0.42, italic: false, fontFamily: '"JetBrains Mono", monospace', fontWeight: 600 },
  { id: 'tracking-wide', label: 'Wide tracking', text: 'EVENTS', width: 74, height: 24, baseFontSize: 0.56, minScale: 0.46, italic: false, letterSpacing: '0.18em' },
  { id: 'tracking-tight', label: 'Tight tracking', text: 'MESSAGES', width: 68, height: 24, baseFontSize: 0.56, minScale: 0.46, italic: false, letterSpacing: '-0.04em' },
  { id: 'danger-small', label: 'Danger tiny', text: 'BREACH', kind: 'danger', width: 55, height: 20, insetX: 4, insetY: 3, baseFontSize: 0.55, minScale: 0.46, italic: false },
  { id: 'danger-long', label: 'Danger long', text: 'SECURITY BREACH DETECTED', kind: 'danger', width: 112, height: 22, insetX: 4, insetY: 3, baseFontSize: 0.55, minScale: 0.28, italic: false },
  { id: 'square-icon-label', label: 'Square label', text: 'MAIN', kind: 'button', width: 48, height: 48, insetLeft: 5, insetRight: 5, insetTop: 24, insetBottom: 5, baseFontSize: 0.52, minScale: 0.44, italic: false },
  { id: 'micro-chip', label: 'Micro chip', text: 'XP', kind: 'badge', width: 28, height: 18, insetX: 3, insetY: 2, baseFontSize: 0.5, minScale: 0.5, italic: true },
  { id: 'minimum-scale', label: 'Minimum scale', text: 'VERY LONG SINGLE LINE THAT MUST SHRINK', width: 130, height: 24, insetX: 4, insetY: 3, baseFontSize: 0.62, minScale: 0.22, italic: false },
  { id: 'two-line-button-left', label: 'Left button text', text: 'CLAIM\nREWARD', kind: 'button', width: 84, height: 34, insetX: 7, insetY: 4, baseFontSize: 0.62, maxLines: 2, minScale: 0.46, align: 'left', italic: true },
  { id: 'two-line-button-right', label: 'Right button text', text: 'OPEN\nPACK', kind: 'button', width: 84, height: 34, insetX: 7, insetY: 4, baseFontSize: 0.62, maxLines: 2, minScale: 0.46, align: 'right', italic: true },
];

const internationalCases: GameTextCase[] = [
  { id: 'ja-fixed-button', section: 'international', label: 'Japanese fixed', text: '任務\n開始', kind: 'button', width: 70, height: 34, insetX: 6, insetY: 4, baseFontSize: 0.72, maxLines: 2, minScale: 0.45, italic: false, textTransform: 'none', fitMode: 'fixed-lines', lang: 'ja' },
  { id: 'ja-long-single', section: 'international', label: 'Japanese long', text: 'セキュリティ解除', kind: 'button', width: 86, height: 28, insetX: 6, insetY: 4, baseFontSize: 0.68, minScale: 0.32, italic: false, textTransform: 'none', fitMode: 'single-line', lang: 'ja' },
  { id: 'zh-no-space', section: 'international', label: 'Chinese label', text: '数据提取任务', kind: 'button', width: 84, height: 28, insetX: 6, insetY: 4, baseFontSize: 0.68, minScale: 0.36, italic: false, textTransform: 'none', fitMode: 'single-line', lang: 'zh' },
  { id: 'ko-button', section: 'international', label: 'Korean label', text: '계약 보기', kind: 'button', width: 76, height: 28, insetX: 6, insetY: 4, baseFontSize: 0.66, minScale: 0.42, italic: false, textTransform: 'none', fitMode: 'single-line', lang: 'ko' },
  { id: 'ar-single', section: 'international', label: 'Arabic RTL', text: 'عرض العقد', kind: 'button', width: 86, height: 30, insetX: 7, insetY: 4, baseFontSize: 0.72, minScale: 0.4, align: 'center', italic: false, textTransform: 'none', fitMode: 'single-line', lang: 'ar', dir: 'rtl' },
  { id: 'ar-fixed-lines', section: 'international', label: 'Arabic two-line', text: 'بدء\nالمهمة', kind: 'button', width: 76, height: 36, insetX: 7, insetY: 4, baseFontSize: 0.68, maxLines: 2, minScale: 0.38, align: 'center', italic: false, textTransform: 'none', fitMode: 'fixed-lines', lang: 'ar', dir: 'rtl' },
  { id: 'mixed-latin-ja', section: 'international', label: 'Mixed label', text: 'SECTOR 七', kind: 'badge', width: 82, height: 24, insetX: 7, insetY: 3, baseFontSize: 0.58, minScale: 0.45, italic: false, textTransform: 'none', fitMode: 'single-line', lang: 'ja' },
  { id: 'accented-latin', section: 'international', label: 'Accented Latin', text: 'CRÉDITS ÉQUIPE', kind: 'button', width: 94, height: 28, insetX: 6, insetY: 4, baseFontSize: 0.62, minScale: 0.36, italic: true, textTransform: 'uppercase', fitMode: 'single-line', lang: 'fr' },
  { id: 'de-compound', section: 'international', label: 'Long compound', text: 'SICHERHEITSPRÜFUNG', kind: 'danger', width: 106, height: 24, insetX: 5, insetY: 3, baseFontSize: 0.56, minScale: 0.24, italic: false, textTransform: 'uppercase', fitMode: 'single-line', lang: 'de' },
  { id: 'cjk-paragraph', section: 'international', label: 'CJK paragraph', text: '暗号化されたデータを回収し、区域を離脱する。', width: 118, height: 54, insetX: 5, insetY: 4, baseFontSize: 0.5, maxLines: 3, minScale: 0.36, align: 'left', italic: false, textTransform: 'none', lineHeight: 1.08, fitMode: 'paragraph', lang: 'ja' },
];

const typographyVariants: Array<{
  id: TypographyVariantId;
  label: string;
  fontWeight: number;
  italic: boolean;
}> = [
  { id: 'normal', label: 'Normal', fontWeight: 500, italic: false },
  { id: 'bold', label: 'Bold', fontWeight: 900, italic: false },
  { id: 'italic', label: 'Italic', fontWeight: 500, italic: true },
  { id: 'bold-italic', label: 'Bold Italic', fontWeight: 900, italic: true },
];

const fitFilters: Array<{ id: FitFilterId; label: string }> = [
  { id: 'single-line', label: 'Single Line' },
  { id: 'fixed-lines', label: 'Fixed Lines' },
  { id: 'paragraph', label: 'Paragraph' },
];

const languageFilters: Array<{ id: LanguageFilterId; label: string }> = [
  { id: 'latin', label: 'English/Latin' },
  { id: 'japanese', label: 'Japanese' },
  { id: 'chinese', label: 'Chinese' },
  { id: 'korean', label: 'Korean' },
  { id: 'arabic', label: 'Arabic' },
  { id: 'mixed', label: 'Mixed' },
];

const fitModeForCase = (testCase: GameTextCase): GameTextV2FitMode => {
  if (testCase.fitMode) return testCase.fitMode;
  if ((testCase.maxLines ?? 1) <= 1) return 'single-line';
  return testCase.text.includes('\n') ? 'fixed-lines' : 'paragraph';
};

const languageForCase = (testCase: GameTextCase): LanguageFilterId => {
  if (testCase.id === 'mixed-latin-ja') return 'mixed';
  if (testCase.lang === 'ja') return 'japanese';
  if (testCase.lang === 'zh') return 'chinese';
  if (testCase.lang === 'ko') return 'korean';
  if (testCase.lang === 'ar') return 'arabic';
  return 'latin';
};

const expandV2Cases = (testCases: GameTextCase[]) => testCases.flatMap((testCase) => (
  typographyVariants.map((variant) => ({
    ...testCase,
    id: `${testCase.id}--${variant.id}`,
    label: `${testCase.label} / ${variant.label}`,
    fontWeight: variant.fontWeight,
    italic: variant.italic,
    typographyVariant: variant.id,
  }))
));

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const overflowAmount = (inner: DOMRect, outer: DOMRect) => Math.max(
  outer.left - inner.left,
  inner.right - outer.right,
  0,
);

const verticalOverflowAmount = (inner: DOMRect, outer: DOMRect) => Math.max(
  outer.top - inner.top,
  inner.bottom - outer.bottom,
  0,
);

const alignmentDeltaX = (inner: DOMRect, outer: DOMRect, align: GameTextAlign) => {
  if (align === 'left') return Math.abs(inner.left - outer.left);
  if (align === 'right') return Math.abs(inner.right - outer.right);
  return Math.abs((inner.left + inner.width / 2) - (outer.left + outer.width / 2));
};

const alignmentDeltaY = (inner: DOMRect, outer: DOMRect, align: GameTextVerticalAlign) => {
  if (align === 'top') return Math.abs(inner.top - outer.top);
  if (align === 'bottom') return Math.abs(inner.bottom - outer.bottom);
  return Math.abs((inner.top + inner.height / 2) - (outer.top + outer.height / 2));
};

const auditGameText = async (testCases: GameTextCase[]): Promise<GameTextAuditSummary> => {
  await document.fonts.ready;
  await wait(180);

  const results = testCases.map((testCase) => {
    const root = document.querySelector<HTMLElement>(`[data-game-text-case="${testCase.id}"]`);
    const container = root?.querySelector<HTMLElement>('[data-game-text="container"]');
    const inner = root?.querySelector<HTMLElement>('[data-game-text="inner"]');
    const failures: string[] = [];

    if (!root || !container || !inner) {
      return {
        id: testCase.id,
        passed: false,
        scale: 0,
        overflowX: 0,
        overflowY: 0,
        centerDeltaX: null,
        centerDeltaY: null,
        failures: ['missing DOM nodes'],
      };
    }

    const outerRect = container.getBoundingClientRect();
    const innerRect = inner.getBoundingClientRect();
    const scale = Number(inner.dataset.gameTextScale || '1');
    const overflowX = overflowAmount(innerRect, outerRect);
    const overflowY = verticalOverflowAmount(innerRect, outerRect);
    const align = testCase.align ?? 'center';
    const verticalAlign = testCase.verticalAlign ?? 'center';
    const centerDeltaX = alignmentDeltaX(innerRect, outerRect, align);
    const centerDeltaY = alignmentDeltaY(innerRect, outerRect, verticalAlign);
    const alignToleranceX = align === 'center' ? Math.max(2.25, outerRect.width * 0.08) : 4;
    const alignToleranceY = verticalAlign === 'center' ? Math.max(2.25, outerRect.height * 0.1) : 4;

    if (innerRect.width <= 0 || innerRect.height <= 0) failures.push('empty text rect');
    if (outerRect.width <= 0 || outerRect.height <= 0) failures.push('empty container rect');
    if (overflowX > 1.25) failures.push(`horizontal overflow ${overflowX.toFixed(2)}px`);
    if (overflowY > 1.25) failures.push(`vertical overflow ${overflowY.toFixed(2)}px`);
    if (centerDeltaX > alignToleranceX) failures.push(`${align} alignment drift ${centerDeltaX.toFixed(2)}px`);
    if (centerDeltaY > alignToleranceY) failures.push(`${verticalAlign} alignment drift ${centerDeltaY.toFixed(2)}px`);
    if (scale < (testCase.minScale ?? 0.2) - 0.01) failures.push(`scale below min ${scale.toFixed(3)}`);
    if (scale > (testCase.maxScale ?? 1) + 0.01) failures.push(`scale above max ${scale.toFixed(3)}`);

    return {
      id: testCase.id,
      passed: failures.length === 0,
      scale,
      overflowX,
      overflowY,
      centerDeltaX,
      centerDeltaY,
      failures,
    };
  });

  const summary = {
    passed: results.filter((item) => item.passed).length,
    failed: results.filter((item) => !item.passed).length,
    total: results.length,
    results,
  };
  window.__gameTextAuditResults = summary;
  return summary;
};

const caseStyle = (testCase: GameTextCase) => ({
  '--gt-box-width': `${testCase.width}px`,
  '--gt-box-height': `${testCase.height}px`,
  '--gt-inset-top': `${testCase.insetTop ?? testCase.insetY ?? 0}px`,
  '--gt-inset-right': `${testCase.insetRight ?? testCase.insetX ?? 0}px`,
  '--gt-inset-bottom': `${testCase.insetBottom ?? testCase.insetY ?? 0}px`,
  '--gt-inset-left': `${testCase.insetLeft ?? testCase.insetX ?? 0}px`,
});

export const GameTextTestScreen = (props: { version?: 'v1' | 'v2' }) => {
  const [summary, setSummary] = createSignal<GameTextAuditSummary | null>(null);
  const [enabledVariants, setEnabledVariants] = createSignal<ReadonlySet<TypographyVariantId>>(new Set(typographyVariants.map((item) => item.id)));
  const [enabledFitModes, setEnabledFitModes] = createSignal<ReadonlySet<FitFilterId>>(new Set(fitFilters.map((item) => item.id)));
  const [enabledLanguages, setEnabledLanguages] = createSignal<ReadonlySet<LanguageFilterId>>(new Set(languageFilters.map((item) => item.id)));
  const version = () => props.version ?? 'v1';
  const isV2 = () => version() === 'v2';
  const allCases = createMemo(() => isV2() ? expandV2Cases([...coreCases, ...internationalCases]) : coreCases);
  const cases = createMemo(() => allCases().filter((testCase) => {
    if (!isV2()) return true;
    const variant = testCase.typographyVariant ?? 'normal';
    return enabledVariants().has(variant)
      && enabledFitModes().has(fitModeForCase(testCase))
      && enabledLanguages().has(languageForCase(testCase));
  }));
  const resultById = () => new Map(summary()?.results.map((item) => [item.id, item]) ?? []);
  const toggleFilter = <T extends string>(
    value: T,
    current: ReadonlySet<T>,
    setter: (next: ReadonlySet<T>) => void,
  ) => {
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  createEffect(() => {
    const activeCases = cases();
    const runAudit = () => auditGameText(activeCases);
    if (isV2()) {
      window.__gameTextV2Audit = runAudit;
      void runAudit().then((result) => {
        window.__gameTextV2AuditResults = result;
        setSummary(result);
      });
      return;
    }
    window.__gameTextAudit = runAudit;
    void runAudit().then((result) => {
      window.__gameTextAuditResults = result;
      setSummary(result);
    });
  });

  return (
    <main class="game-text-test-page">
      <div class="game-text-test-shell">
        <header class="game-text-test-header">
          <div>
            <h1>{isV2() ? 'GameTextV2 Fit Lab' : 'GameText Fit Lab'}</h1>
            <p>
              {isV2()
                ? 'V2 proves explicit fit modes, grouped text styling, font-load remeasurement, and language direction handling before material UI adopts it.'
                : 'Fixed-size boxes and button-like surfaces for proving that fitted game labels scale, align, and stay inside their text boxes before we wire them into material nodes.'}
            </p>
          </div>
          <div class="game-text-test-summary">
            <strong>{summary() ? `${summary()!.passed}/${summary()!.total}` : '...'}</strong>
            <span>{summary()?.failed ? `${summary()!.failed} failing: ${summary()!.results.filter((item) => !item.passed).map((item) => item.id).join(', ')}` : isV2() ? `${cases().length} visible of ${allCases().length}` : 'DOM audit'}</span>
          </div>
        </header>

        {isV2() && (
          <section class="game-text-test-filters" aria-label="GameTextV2 filters">
            <div class="game-text-test-filter-group">
              <strong>Style</strong>
              <For each={typographyVariants}>
                {(variant) => (
                  <label>
                    <input
                      type="checkbox"
                      checked={enabledVariants().has(variant.id)}
                      onInput={() => toggleFilter(variant.id, enabledVariants(), setEnabledVariants)}
                    />
                    <span>{variant.label}</span>
                  </label>
                )}
              </For>
            </div>
            <div class="game-text-test-filter-group">
              <strong>Fit</strong>
              <For each={fitFilters}>
                {(fit) => (
                  <label>
                    <input
                      type="checkbox"
                      checked={enabledFitModes().has(fit.id)}
                      onInput={() => toggleFilter(fit.id, enabledFitModes(), setEnabledFitModes)}
                    />
                    <span>{fit.label}</span>
                  </label>
                )}
              </For>
            </div>
            <div class="game-text-test-filter-group">
              <strong>Script</strong>
              <For each={languageFilters}>
                {(language) => (
                  <label>
                    <input
                      type="checkbox"
                      checked={enabledLanguages().has(language.id)}
                      onInput={() => toggleFilter(language.id, enabledLanguages(), setEnabledLanguages)}
                    />
                    <span>{language.label}</span>
                  </label>
                )}
              </For>
            </div>
          </section>
        )}

        <section class="game-text-test-grid">
          <For each={cases()}>
            {(testCase) => {
              const result = () => resultById().get(testCase.id);
              return (
                <article
                  class={`game-text-test-case ${result()?.passed ? 'is-pass' : result() ? 'is-fail' : ''}`}
                  data-game-text-case={testCase.id}
                  data-game-text-variant={testCase.typographyVariant}
                  data-game-text-fit={fitModeForCase(testCase)}
                  data-game-text-language={languageForCase(testCase)}
                >
                  <div class="game-text-test-meta">
                    <div class="game-text-test-title">
                      <strong>{testCase.label}</strong>
                      <span>{testCase.width}x{testCase.height} / {fitModeForCase(testCase)} / {languageForCase(testCase)}</span>
                    </div>
                    <div class="game-text-test-result">
                      {result() ? (result()!.passed ? 'pass' : 'fail') : 'measuring'}
                    </div>
                  </div>
                  <div class="game-text-test-stage">
                    <div
                      class={`game-text-test-frame game-text-test-frame--${testCase.kind ?? 'plain'}`}
                      data-game-text-test-frame
                      style={caseStyle(testCase)}
                    >
                      <div class="game-text-test-label-box">
                        {isV2() ? (
                          <GameTextV2
                            text={testCase.text}
                            baseFontSize={testCase.baseFontSize}
                            minScale={testCase.minScale}
                            maxScale={testCase.maxScale}
                            maxLines={testCase.maxLines}
                            fitMode={testCase.fitMode}
                            align={testCase.align}
                            verticalAlign={testCase.verticalAlign}
                            lang={testCase.lang}
                            dir={testCase.dir}
                            textStyle={{
                              fontFamily: testCase.fontFamily,
                              fontWeight: testCase.fontWeight,
                              fontStyle: testCase.italic === false ? 'normal' : 'italic',
                              letterSpacing: testCase.letterSpacing,
                              lineHeight: testCase.lineHeight,
                              textTransform: testCase.textTransform,
                            }}
                          />
                        ) : (
                          <GameText
                            text={testCase.text}
                            baseFontSize={testCase.baseFontSize}
                            minScale={testCase.minScale}
                            maxScale={testCase.maxScale}
                            maxLines={testCase.maxLines}
                            align={testCase.align}
                            verticalAlign={testCase.verticalAlign}
                            italic={testCase.italic}
                            letterSpacing={testCase.letterSpacing}
                            fontFamily={testCase.fontFamily}
                            fontWeight={testCase.fontWeight}
                            textTransform={testCase.textTransform}
                            lineHeight={testCase.lineHeight}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  <div class="game-text-test-result">
                    {result()?.failures.join(' / ') || `scale ${result()?.scale.toFixed(3) ?? '...'}`}
                  </div>
                </article>
              );
            }}
          </For>
        </section>

        <pre class="game-text-test-json">{JSON.stringify(summary(), null, 2)}</pre>
      </div>
    </main>
  );
};
