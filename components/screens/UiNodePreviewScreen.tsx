import '../../src/styles/ui-material-lab.css';
import { createSignal, Show } from 'solid-js';
import {
  renderUiNodeToSolid,
  validateUiNode,
  type UiNodePayload,
  type UiNodeRenderContext,
} from '../ui/material-lab';

// A server-style UI payload: pure JSON intent. No markup, no CSS strings.
// This is the shape a server (or downloadable skin) would deliver.
const samplePayload: UiNodePayload = {
  id: 'briefing-card',
  type: 'panel',
  surface: {
    material: 'custom',
    materialColor: '#1b1e24',
    texture: 'none',
    glass: true,
    glassOpacity: 28,
    gradient: 'both',
    lightStrength: 14,
    darkStrength: 30,
    border: ['top', 'right', 'bottom', 'left'],
    borderColor: 'custom',
    borderCustomColor: '#3a4049',
    borderOpacity: 60,
    radius: 16,
    dropShadow: true,
    shadowOpacity: 55,
    shadowBlur: 28,
    shadowY: 10,
  },
  layout: { display: 'flex', direction: 'column', gap: 16, padding: 24, width: '420px' },
  children: [
    {
      id: 'title',
      type: 'text',
      contentBinding: 'title',
      layout: { padding: 0 },
    },
    {
      id: 'body',
      type: 'text',
      materialId: 'body-panel',
      text: 'Rendered from validated JSON through one surface component. The server sends intent; the client owns the pixels.',
      layout: { padding: 16 },
    },
    {
      id: 'cta',
      type: 'button',
      stateModel: 'momentary',
      contentBinding: 'ctaLabel',
      action: { id: 'accept', params: { contractId: 'c-001' } },
      surface: {
        material: 'custom',
        materialColor: '#707275',
        texture: 'stone04',
        textureStrength: 80,
        glass: true,
        glassOpacity: 15,
        gradient: 'both',
        lightStrength: 60,
        darkStrength: 36,
        border: ['top', 'right', 'bottom', 'left'],
        borderColor: 'custom',
        borderCustomColor: '#eaeaea',
        borderOpacity: 54,
        dropShadow: true,
        shadowOpacity: 55,
        shadowBlur: 6,
        shadowY: 3,
        radius: 6,
        contentTone: 'black',
        textTransform: 'uppercase',
        fontStyle: 'normal',
        fontWeight: 800,
        letterSpacing: 0.05,
      },
      surfaceStates: {
        hover: {
          tint: 'gold',
          tintStrength: 28,
          borderOpacity: 82,
          lightStrength: 76,
        },
        pressed: {
          glow: 'gold',
          glowStrength: 48,
          corners: 'all',
          emission: 'center-blip',
          emissionTone: 'gold',
          emissionStrength: 44,
          stateScale: 0.97,
          stateTranslateY: 2,
        },
      },
      layout: { width: '100%' },
    },
    {
      id: 'skin-cta',
      type: 'button',
      materialId: 'cta-secondary',
      contentBinding: 'skinCtaLabel',
      action: { id: 'inspectSkin', params: { materialId: 'cta-secondary' } },
      layout: { width: '100%' },
    },
  ],
};

const bindings: Record<string, string> = {
  title: 'Contract Briefing',
  ctaLabel: 'Accept Contract',
  skinCtaLabel: 'Skin Registry CTA',
};

export const UiNodePreviewScreen = () => {
  const [lastAction, setLastAction] = createSignal<string>('(none)');

  const context: UiNodeRenderContext = {
    resolveBinding: (binding) => bindings[binding],
    onAction: (action) => setLastAction(`${action.id} ${JSON.stringify(action.params ?? {})}`),
  };

  // Fail-closed: a malformed payload validates to null and we render nothing.
  const node = validateUiNode(samplePayload, 'ui-node-preview');

  return (
    <div style={{ 'min-height': '100%', width: '100%', display: 'flex', 'flex-direction': 'column', 'align-items': 'center', gap: '20px', padding: '40px', background: 'radial-gradient(circle at 50% 0%, #1a1d22, #0a0c0f 70%)', 'box-sizing': 'border-box', overflow: 'auto' }}>
      <h1 style={{ color: '#e7e3d6', font: "700 1.1rem 'DIN Condensed', system-ui, sans-serif", 'letter-spacing': '0.1em', 'text-transform': 'uppercase', margin: '0' }}>
        UiNodePayload → Surface
      </h1>

      <Show when={node} fallback={<p style={{ color: '#ff7a6e' }}>Payload failed validation (rendered nothing — fail closed).</p>}>
        {(valid) => renderUiNodeToSolid(valid(), context)}
      </Show>

      <p style={{ color: '#8f897c', font: "400 0.8rem ui-monospace, monospace", margin: '0' }}>
        last action: {lastAction()}
      </p>

      <pre style={{ color: '#6f7681', font: '0.72rem ui-monospace, monospace', background: 'rgba(0,0,0,0.4)', padding: '16px', 'border-radius': '8px', 'max-width': '560px', overflow: 'auto', margin: '0' }}>
        {JSON.stringify(samplePayload, null, 2)}
      </pre>
    </div>
  );
};
