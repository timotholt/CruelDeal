import type {
  EmissionMetrics,
  EmittedLayer,
  MaterialEmissionPlan,
} from '../../ui/material-lab';

export interface DomAuditToken {
  key: string;
  name: string;
  value: string;
  kind: 'known' | 'unknown';
  reason: string;
  source: string;
  cssRules?: string[];
}

export interface DomAuditNode {
  path: string;
  tag: string;
  text: string;
  classes: DomAuditToken[];
  attrs: DomAuditToken[];
  styles: DomAuditToken[];
  children: DomAuditNode[];
}

const provenance = (source: string, reason: string) => ({ source, reason });

export const classProvenance = (className: string): { source: string; reason: string } | null => {
  if (className === 'main-material-card-node') return provenance('layout', 'unified layout frame');
  if (className.startsWith('main-material-card-node--')) return provenance('layout', 'node kind frame');
  if (className.startsWith('main-material-card-node-surface')) return provenance('base', 'material surface slot');
  if (className.startsWith('cd-surface--texture') || className.includes('texture')) return provenance('texture', 'texture material class');
  if (className.startsWith('cd-surface--gradient') || className.includes('gradient')) return provenance('gradient', 'gradient material class');
  if (className.startsWith('cd-surface--glass') || className.includes('glass')) return provenance('frosted', 'glass material class');
  if (className.startsWith('cd-surface--border') || className.includes('border')) return provenance('border', 'border material class');
  if (className.startsWith('cd-surface--edge') || className.includes('edge')) return provenance('edge', 'edge wear material class');
  if (className.includes('shadow') || className.includes('glow')) return provenance('shadow', 'shadow/glow material class');
  if (className.startsWith('cd-surface') || className.startsWith('cd-button') || className.startsWith('cd-panel')) return provenance('base', 'material primitive');
  if (className.startsWith('material-text-content')) return provenance('text', 'text renderer');
  if (className.startsWith('is-editing')) return provenance('selected', 'selection overlay');
  if (className.startsWith('is-visual') || className === 'is-selected' || className === 'is-interactive' || className === 'is-active') return provenance('state', 'interactive state');
  if (className.startsWith('main-material-')) return provenance('skin', 'preview skin/layout');
  return null;
};

export const attrProvenance = (name: string): { source: string; reason: string } | null => {
  if (name === 'data-material-target-id') return provenance('selected', 'selection/interaction lookup');
  if (name === 'data-material-role') return provenance('state', 'preview state resolution');
  if (name === 'data-feed-layout-mode' || name === 'data-feed-layout-slot') return provenance('layout', 'layout compatibility selector');
  if (name === 'data-w-mode' || name === 'data-h-mode' || name === 'data-direction' || name === 'data-wrap') return provenance('layout', 'layout selector');
  if (name === 'data-css-probe-target') return provenance('selected', 'emission inspector marker');
  if (name === 'data-material-surface') return provenance('base', 'material primitive marker');
  if (name === 'data-emission') return provenance('base', 'emission layer selector');
  if (name === 'data-emission-edge') return provenance('edge', 'edge emission selector');
  if (name.startsWith('data-game-text') || name.startsWith('data-material-text')) return provenance('text', 'text renderer instrumentation');
  if (name === 'aria-label' || name === 'aria-hidden' || name === 'aria-current') return provenance('a11y', 'accessibility');
  if (name === 'role' || name === 'type' || name === 'disabled') return provenance('native', 'native behavior');
  return null;
};

export const styleProvenance = (name: string): { source: string; reason: string } | null => {
  if (name.startsWith('--feed-node')) return provenance('layout', 'layout custom property');
  if (name.startsWith('--material') || name.startsWith('--surface')) return provenance('base', 'material base variable');
  if (name.startsWith('--content') || name.startsWith('--icon')) return provenance('text', 'content/text variable');
  if (name.startsWith('--texture')) return provenance('texture', 'texture variable');
  if (name.startsWith('--border')) return provenance('border', 'border variable');
  if (name.startsWith('--edge')) return provenance('edge', 'edge wear variable');
  if (name.startsWith('--light') || name.startsWith('--dark')) return provenance('gradient', 'highlight/shade variable');
  if (name === 'inset' || name === 'position' || name === 'left' || name === 'right' || name === 'top' || name === 'bottom') return provenance('layout', 'position emission');
  if (name === 'width' || name === 'height' || name === 'min-width' || name === 'min-height' || name === 'flex' || name === 'display') return provenance('layout', 'box sizing emission');
  if (name === 'margin' || name.startsWith('margin-') || name === 'padding' || name.startsWith('padding-') || name === 'gap' || name === 'row-gap' || name === 'column-gap') return provenance('layout', 'spacing emission');
  if (name === 'align-items' || name === 'justify-content' || name === 'text-align' || name === 'flex-direction' || name === 'flex-wrap') return provenance('layout', 'alignment emission');
  if (name.includes('background') || name.includes('color')) return provenance('base', 'base color emission');
  if (name.includes('texture')) return provenance('texture', 'texture variable');
  if (name.includes('gradient')) return provenance('gradient', 'gradient variable');
  if (name.includes('blur') || name.includes('glass')) return provenance('frosted', 'glass/blur variable');
  if (name.includes('border')) return provenance('border', 'border variable');
  if (name.includes('edge')) return provenance('edge', 'edge wear variable');
  if (name.includes('shadow') || name.includes('glow')) return provenance('shadow', 'shadow/glow variable');
  if (name.includes('font') || name.includes('text') || name.includes('line-height') || name.includes('letter-spacing')) return provenance('text', 'text variable');
  return null;
};

export const auditToken = (
  key: string,
  name: string,
  value: string,
  info: { source: string; reason: string } | null,
  cssRules?: string[],
): DomAuditToken => ({
  key,
  name,
  value,
  kind: info ? 'known' : 'unknown',
  reason: info?.reason || 'unclassified',
  source: info?.source || 'unknown',
  cssRules,
});

export const parseStyleTokens = (style: string): DomAuditToken[] => (
  style
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf(':');
      const name = separator >= 0 ? part.slice(0, separator).trim() : part;
      const value = separator >= 0 ? part.slice(separator + 1).trim() : '';
      return auditToken(`style:${name}`, name, value, styleProvenance(name));
    })
);

export const transientDomClass = (className: string) => (
  className.startsWith('is-editing')
);

export const transientDomAttr = (name: string) => (
  name === 'data-css-probe-target'
);

export const serializeDomAuditNode = (
  element: Element,
  path = '0',
  hiddenClasses: ReadonlySet<string> = new Set(),
  collectClassCssRules: (className: string) => string[] = () => [],
): DomAuditNode => {
  const text = Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent?.trim() || '')
    .filter(Boolean)
    .join(' ');
  return {
    path,
    tag: element.tagName.toLowerCase(),
    text,
    classes: Array.from(element.classList)
      .filter((className) => !transientDomClass(className))
      .map((className) => auditToken(`${path}:class:${className}`, 'class', className, classProvenance(className), collectClassCssRules(className)))
      .filter((token) => !hiddenClasses.has(token.key)),
    attrs: Array.from(element.attributes)
      .filter((attr) => attr.name !== 'class' && attr.name !== 'style' && !transientDomAttr(attr.name))
      .map((attr) => auditToken(`${path}:attr:${attr.name}`, attr.name, attr.value, attrProvenance(attr.name))),
    styles: parseStyleTokens(element.getAttribute('style') || ''),
    children: Array.from(element.children).map((child, index) => serializeDomAuditNode(child, `${path}.${index}`, hiddenClasses, collectClassCssRules)),
  };
};

const escapeHtml = (value: string) => (
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
);

const escapeAttribute = (value: string) => (
  escapeHtml(value).replace(/"/g, '&quot;')
);

export const domAuditNodeToHtml = (node: DomAuditNode, depth = 0): string => {
  const indent = '  '.repeat(depth);
  const attrs = [
    node.classes.length ? `class="${escapeAttribute(node.classes.map((token) => token.value).join(' '))}"` : '',
    ...node.attrs.map((token) => `${token.name}="${escapeAttribute(token.value)}"`),
    node.styles.length
      ? `style="${escapeAttribute(node.styles.map((token) => `${token.name}: ${token.value};`).join(' '))}"`
      : '',
  ].filter(Boolean);
  const open = `${indent}<${node.tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}>`;
  const text = node.text ? escapeHtml(node.text) : '';
  if (!node.children.length) return `${open}${text}</${node.tag}>`;
  return [
    `${open}${text}`,
    ...node.children.map((child) => domAuditNodeToHtml(child, depth + 1)),
    `${indent}</${node.tag}>`,
  ].join('\n');
};

export const emptyEmissionMetrics = (): EmissionMetrics => ({
  nodeCount: 0,
  classCount: 0,
  attrCount: 0,
  styleCount: 0,
  cssVariableCount: 0,
});

export const domAuditMetrics = (node: DomAuditNode | null): EmissionMetrics => {
  if (!node) return emptyEmissionMetrics();
  return node.children.reduce<EmissionMetrics>((metrics, child) => {
    const childMetrics = domAuditMetrics(child);
    return {
      nodeCount: metrics.nodeCount + childMetrics.nodeCount,
      classCount: metrics.classCount + childMetrics.classCount,
      attrCount: metrics.attrCount + childMetrics.attrCount,
      styleCount: metrics.styleCount + childMetrics.styleCount,
      cssVariableCount: metrics.cssVariableCount + childMetrics.cssVariableCount,
    };
  }, {
    nodeCount: 1,
    classCount: node.classes.length,
    attrCount: node.attrs.length,
    styleCount: node.styles.length,
    cssVariableCount: node.styles.filter((token) => token.name.startsWith('--')).length,
  });
};

export const emittedLayerToDomAuditNode = (layer: EmittedLayer, path = '0'): DomAuditNode => {
  const tag = layer.tag || 'span';
  const classNames = (layer.classNames || []).filter(Boolean);
  const attrs = Object.entries(layer.attrs || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== false && value !== '')
    .map(([name, value]) => auditToken(`${path}:attr:${name}`, name, value === true ? '' : String(value), attrProvenance(name)));
  const styles = Object.entries(layer.style || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== false && value !== '')
    .map(([name, value]) => auditToken(`${path}:style:${name}`, name, String(value), styleProvenance(name)));
  return {
    path,
    tag,
    text: layer.text || '',
    classes: classNames.map((className) => auditToken(`${path}:class:${className}`, 'class', className, classProvenance(className))),
    attrs,
    styles,
    children: (layer.children || []).map((child, index) => emittedLayerToDomAuditNode(child, `${path}.${index}`)),
  };
};

export const exportPlanToDomAuditNode = (plan: MaterialEmissionPlan | null): DomAuditNode | null => {
  if (!plan) return null;
  return emittedLayerToDomAuditNode({
    ...plan.host,
    children: [
      ...plan.layers.flatMap((layer) => layer.emission ? [layer.emission] : []),
      ...(plan.host.children || []),
    ],
  });
};

