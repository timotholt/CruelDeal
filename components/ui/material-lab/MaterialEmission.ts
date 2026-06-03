export type MaterialRenderMode = 'editor' | 'runtime' | 'export';

export type MaterialEmissionValue = string | number | boolean;
export type MaterialEmissionStyleValue = string | number | undefined | null | false;

export interface MaterialEmissionProvenance {
  source: string;
  reason: string;
  modes: MaterialRenderMode[];
}

export interface EmittedLayer {
  tag?: string;
  classNames?: string[];
  attrs?: Record<string, MaterialEmissionValue | undefined | null | false>;
  style?: Record<string, MaterialEmissionStyleValue>;
  text?: string;
  children?: EmittedLayer[];
  provenance?: Partial<Record<'class' | 'attr' | 'style' | 'node' | 'text', MaterialEmissionProvenance>>;
}

export interface MaterialLayerPlan {
  id: string;
  label: string;
  active: boolean;
  reason: string;
  emission: EmittedLayer | null;
}

export interface MaterialEmissionPlan {
  mode: MaterialRenderMode;
  host: EmittedLayer & { tag: string };
  layers: MaterialLayerPlan[];
  cssRules?: string[];
}

export interface EmissionMetrics {
  nodeCount: number;
  classCount: number;
  attrCount: number;
  styleCount: number;
  cssVariableCount: number;
}

const isZeroLength = (value: MaterialEmissionStyleValue) => (
  value === 0 || value === '0' || value === '0px' || value === '0rem' || value === '0em' || value === '0%'
);

const noOpStyleValue = (key: string, value: MaterialEmissionStyleValue) => {
  if (value === undefined || value === null || value === false || value === '') return true;
  if (key === 'transform' && (value === 'none' || value === 'translate(0px, 0px)' || value === 'translate(0, 0)')) return true;
  if ((key === 'padding' || key === 'padding-inline' || key === 'padding-block' || key === 'gap') && isZeroLength(value)) return true;
  if (key === 'letter-spacing' && isZeroLength(value)) return true;
  if (key === 'text-align' && value === 'center') return true;
  if (key === 'font-style' && value === 'normal') return true;
  if (key === 'text-transform' && value === 'none') return true;
  if (typeof value === 'string' && (value === 'transparent' || value === 'rgba(0, 0, 0, 0)' || value.endsWith('/ 0)'))) return true;
  return false;
};

export const compactStyle = (
  style: Record<string, MaterialEmissionStyleValue> = {},
  defaults: Record<string, MaterialEmissionStyleValue> = {},
) => (
  Object.fromEntries(
    Object.entries(style).filter(([key, value]) => (
      !noOpStyleValue(key, value) && value !== defaults[key]
    )),
  ) as Record<string, string | number>
);

const compactAttrs = (attrs: EmittedLayer['attrs'] = {}) => (
  Object.fromEntries(
    Object.entries(attrs).filter(([, value]) => value !== undefined && value !== null && value !== false && value !== ''),
  ) as Record<string, MaterialEmissionValue>
);

export const compactLayer = (layer: EmittedLayer): EmittedLayer => ({
  ...layer,
  classNames: layer.classNames?.filter(Boolean),
  attrs: compactAttrs(layer.attrs),
  style: compactStyle(layer.style),
  children: layer.children?.map(compactLayer).filter((child) => (
    child.tag || child.text || child.children?.length
  )),
});

const escapeHtml = (value: string) => (
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
);

const escapeAttribute = (value: string) => escapeHtml(value).replace(/"/g, '&quot;');

const styleText = (style: Record<string, string | number>) => (
  Object.entries(style).map(([key, value]) => `${key}: ${value};`).join(' ')
);

export const serializeEmittedLayerHtml = (layer: EmittedLayer, depth = 0): string => {
  const tag = layer.tag || 'span';
  const indent = '  '.repeat(depth);
  const compact = compactLayer(layer);
  const attrs = [
    compact.classNames?.length ? `class="${escapeAttribute(compact.classNames.join(' '))}"` : '',
    ...Object.entries(compact.attrs || {}).map(([key, value]) => (
      value === true ? key : `${key}="${escapeAttribute(String(value))}"`
    )),
    compact.style && Object.keys(compact.style).length ? `style="${escapeAttribute(styleText(compact.style as Record<string, string | number>))}"` : '',
  ].filter(Boolean);
  const open = `${indent}<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}>`;
  const text = compact.text ? escapeHtml(compact.text) : '';
  const children = compact.children || [];
  if (!children.length) return `${open}${text}</${tag}>`;
  return [
    `${open}${text}`,
    ...children.map((child) => serializeEmittedLayerHtml(child, depth + 1)),
    `${indent}</${tag}>`,
  ].join('\n');
};

export const serializeEmissionPlanHtml = (plan: MaterialEmissionPlan) => serializeEmittedLayerHtml({
  ...plan.host,
  children: [
    ...plan.layers.flatMap((layer) => layer.emission ? [layer.emission] : []),
    ...(plan.host.children || []),
  ],
});

export const serializeEmissionPlanCss = (plan: MaterialEmissionPlan) => (plan.cssRules || []).join('\n');

const measureLayer = (layer: EmittedLayer): EmissionMetrics => {
  const style = compactStyle(layer.style);
  const attrs = compactAttrs(layer.attrs);
  const children = layer.children || [];
  return children.reduce<EmissionMetrics>((metrics, child) => {
    const childMetrics = measureLayer(child);
    return {
      nodeCount: metrics.nodeCount + childMetrics.nodeCount,
      classCount: metrics.classCount + childMetrics.classCount,
      attrCount: metrics.attrCount + childMetrics.attrCount,
      styleCount: metrics.styleCount + childMetrics.styleCount,
      cssVariableCount: metrics.cssVariableCount + childMetrics.cssVariableCount,
    };
  }, {
    nodeCount: layer.tag ? 1 : 0,
    classCount: layer.classNames?.filter(Boolean).length || 0,
    attrCount: Object.keys(attrs).length,
    styleCount: Object.keys(style).length,
    cssVariableCount: Object.keys(style).filter((key) => key.startsWith('--')).length,
  });
};

export const measureEmissionPlan = (plan: MaterialEmissionPlan): EmissionMetrics => measureLayer({
  ...plan.host,
  children: [
    ...plan.layers.flatMap((layer) => layer.emission ? [layer.emission] : []),
    ...(plan.host.children || []),
  ],
});
