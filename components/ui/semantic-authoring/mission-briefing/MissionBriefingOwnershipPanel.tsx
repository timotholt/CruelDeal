import { createSignal, For, Show } from 'solid-js';
import {
  missionBriefingOptionalSlots,
  missionBriefingRequiredSlots,
  type MissionBriefingCommand,
  type MissionBriefingCommandResult,
  type MissionBriefingOptionalSlot,
} from './missionBriefingCommands';
import {
  serializeMissionBriefingSourceV1,
  type ContentSourceV1,
  type MissionBriefingSourceV1,
} from './missionBriefingSource';
import type {
  AppearanceGraphSourceV1,
  AppearancePartId,
  MissionAppearanceDocumentV1,
  PaintLayerSourceV1,
} from '../../semantic-compiler/paint/paintSource';
import { serializePaintArtifact } from '../../semantic-compiler/paint/paintCompiler';
import {
  missionFontOptions,
  missionTypographyRoleIds,
  missionTypographyVariantIds,
  type MissionTextStyleV1,
  type MissionTypographyRoleId,
  type MissionTypographyVariantId,
} from '../../semantic-compiler/typography/missionTypography';

const slotLabels: Record<string, string> = {
  availabilityStatus: 'Availability',
  title: 'Title',
  body: 'Body',
  progress: 'Progress',
  terms: 'Typed Terms',
  primaryAction: 'Fingerprint Hold Action',
  deadline: 'Deadline',
  sectorMark: 'Sector Mark',
};

const inlineValue = (source: ContentSourceV1) => ('inline' in source ? source.inline.value : '');
const partLabels: Record<AppearancePartId, string> = {
  panel: 'Panel',
  terms: 'Reward Region',
  primaryAction: 'Primary Action',
};

export const MissionBriefingOwnershipPanel = (props: {
  source: MissionBriefingSourceV1;
  defaults: MissionBriefingSourceV1;
  appearance: MissionAppearanceDocumentV1;
  status: string;
  canUndo: boolean;
  canRedo: boolean;
  compiled: boolean;
  onCommand: (command: MissionBriefingCommand) => MissionBriefingCommandResult;
  onAppearanceChange: (appearance: MissionAppearanceDocumentV1) => void;
  onUndo: () => void;
  onRedo: () => void;
  onCompile: () => void;
  onReturnToLive: () => void;
  onCopy: (serialized: string) => void;
  onCopyAppearance: (serialized: string) => void;
}) => {
  const [selectedPart, setSelectedPart] = createSignal<AppearancePartId>('panel');
  const [selectedTypographyRole, setSelectedTypographyRole] = createSignal<MissionTypographyRoleId>('title');
  const [selectedTypographyVariant, setSelectedTypographyVariant] = createSignal<MissionTypographyVariantId>('base');
  const serialized = () => serializeMissionBriefingSourceV1(props.source);
  const serializedAppearance = () => serializePaintArtifact(props.appearance);
  const presentOptionalSlots = () => missionBriefingOptionalSlots.filter((slot) => props.source.slots[slot] !== undefined);
  const missingOptionalSlots = () => missionBriefingOptionalSlots.filter((slot) => props.source.slots[slot] === undefined && props.defaults.slots[slot] !== undefined);
  const selectedGraphs = () => props.appearance.graphs.filter((graph) => graph.part === selectedPart());

  const contentFormat = (source: ContentSourceV1) => ('inline' in source ? source.inline.format : 'plain');
  const replaceContent = (slot: 'title' | 'body' | 'availabilityStatus', value: string) => {
    props.onCommand({ type: 'slot/replace', slot, value: { inline: { format: contentFormat(props.source.slots[slot]!), value } } });
  };
  const replaceContentFormat = (slot: 'title' | 'body', format: 'plain' | 'cruel-markup-v1') => props.onCommand({
    type: 'slot/replace',
    slot,
    value: { inline: { format, value: inlineValue(props.source.slots[slot]) } },
  });
  const replaceTermsAmount = (kind: 'deposit' | 'successReward', value: number) => {
    const current = props.source.slots.terms;
    const amount = { literal: Math.max(0, Math.round(value || 0)) };
    props.onCommand({
      type: 'slot/replace',
      slot: 'terms',
      value: kind === 'deposit'
        ? { ...current, deposit: { amount, currencyCode: current.deposit?.currencyCode ?? 'credits' } }
        : { ...current, successReward: { ...current.successReward, amount } },
    });
  };
  const replaceActionLabel = (value: string) => props.onCommand({
    type: 'slot/replace',
    slot: 'primaryAction',
    value: { ...props.source.slots.primaryAction, label: { inline: { format: contentFormat(props.source.slots.primaryAction.label), value } } },
  });
  const replaceActionFormat = (format: 'plain' | 'cruel-markup-v1') => props.onCommand({
    type: 'slot/replace',
    slot: 'primaryAction',
    value: { ...props.source.slots.primaryAction, label: { inline: { format, value: inlineValue(props.source.slots.primaryAction.label) } } },
  });
  const restoreOptional = (slot: MissionBriefingOptionalSlot) => {
    const value = props.defaults.slots[slot];
    if (value !== undefined) props.onCommand({ type: 'slot/replace', slot, value: structuredClone(value) });
  };
  const updateGraph = (graphId: string, update: (graph: AppearanceGraphSourceV1) => AppearanceGraphSourceV1) => {
    props.onAppearanceChange({
      ...props.appearance,
      graphs: props.appearance.graphs.map((graph) => graph.id === graphId ? update(graph) : graph),
    });
  };
  const updateLayer = (graphId: string, layerId: string, update: (layer: PaintLayerSourceV1) => PaintLayerSourceV1) => {
    updateGraph(graphId, (graph) => ({
      ...graph,
      layers: graph.layers.map((layer) => layer.id === layerId ? update(layer) : layer),
    }));
  };
  const moveLayer = (graphId: string, layerIndex: number, delta: -1 | 1) => {
    updateGraph(graphId, (graph) => {
      const nextIndex = layerIndex + delta;
      if (nextIndex < 0 || nextIndex >= graph.layers.length) return graph;
      const layers = [...graph.layers];
      [layers[layerIndex], layers[nextIndex]] = [layers[nextIndex], layers[layerIndex]];
      return { ...graph, layers };
    });
  };
  const selectedTypographyStyle = () => {
    const theme = props.appearance.typography[selectedTypographyRole()];
    return { ...theme.base, ...theme[selectedTypographyVariant()] };
  };
  const updateTypographyStyle = (update: Partial<MissionTextStyleV1>) => {
    const role = selectedTypographyRole();
    const variant = selectedTypographyVariant();
    const theme = props.appearance.typography[role];
    const current = variant === 'base' ? theme.base : (theme[variant] ?? {});
    props.onAppearanceChange({
      ...props.appearance,
      typography: {
        ...props.appearance.typography,
        [role]: { ...theme, [variant]: { ...current, ...update } },
      },
    });
  };

  return (
    <div class="ui-lab-stack" data-semantic-editor="MissionBriefingV1">
      <SectionHeading label="Mission Briefing V1" />
      <div class="ui-lab-control-row ui-lab-control-row--stacked">
        <span>Ownership</span>
        <code>Semantic source → compiler → runtime</code>
        <span>The legacy Feed node, binding, layout, and content controls are disabled for this component.</span>
      </div>

      <SectionHeading label="Workflow" />
      <div class="ui-lab-control-row">
        <button type="button" class="ui-lab-mini-button" disabled={!props.canUndo} onClick={props.onUndo}>undo</button>
        <button type="button" class="ui-lab-mini-button" disabled={!props.canRedo} onClick={props.onRedo}>redo</button>
      </div>
      <div class="ui-lab-control-row">
        <button type="button" class="ui-lab-mini-button" onClick={props.onCompile}>compile</button>
        <button type="button" class="ui-lab-mini-button" disabled={!props.compiled} onClick={props.onReturnToLive}>return live</button>
      </div>

      <SectionHeading label="Content" />
      <label class="ui-lab-control-row ui-lab-control-row--stacked">
        <span>Title · rich text supports [bright], [muted], [accent]</span>
        <select class="ui-lab-input" value={contentFormat(props.source.slots.title)} onChange={(event) => replaceContentFormat('title', event.currentTarget.value as 'plain' | 'cruel-markup-v1')}>
          <option value="plain">Plain text</option>
          <option value="cruel-markup-v1">Cruel markup v1</option>
        </select>
        <textarea class="ui-lab-input main-material-text-input" value={inlineValue(props.source.slots.title)} onInput={(event) => replaceContent('title', event.currentTarget.value)} />
      </label>
      <label class="ui-lab-control-row ui-lab-control-row--stacked">
        <span>Body</span>
        <select class="ui-lab-input" value={contentFormat(props.source.slots.body)} onChange={(event) => replaceContentFormat('body', event.currentTarget.value as 'plain' | 'cruel-markup-v1')}>
          <option value="plain">Plain text</option>
          <option value="cruel-markup-v1">Cruel markup v1</option>
        </select>
        <textarea class="ui-lab-input main-material-text-input" value={inlineValue(props.source.slots.body)} onInput={(event) => replaceContent('body', event.currentTarget.value)} />
      </label>
      <Show when={props.source.slots.availabilityStatus}>
        {(value) => (
          <label class="ui-lab-control-row ui-lab-control-row--stacked">
            <span>Availability</span>
            <input class="ui-lab-input main-material-text-input" value={inlineValue(value())} onInput={(event) => replaceContent('availabilityStatus', event.currentTarget.value)} />
          </label>
        )}
      </Show>
      <label class="ui-lab-control-row">
        <span>Deposit CR</span>
        <input type="number" min="0" class="ui-lab-input main-material-text-input" value={'literal' in (props.source.slots.terms.deposit?.amount ?? { literal: 0 }) ? (props.source.slots.terms.deposit?.amount as { literal: number }).literal : 0} onInput={(event) => replaceTermsAmount('deposit', event.currentTarget.valueAsNumber)} />
      </label>
      <label class="ui-lab-control-row">
        <span>Success CR</span>
        <input type="number" min="0" class="ui-lab-input main-material-text-input" value={'literal' in props.source.slots.terms.successReward.amount ? props.source.slots.terms.successReward.amount.literal : 0} onInput={(event) => replaceTermsAmount('successReward', event.currentTarget.valueAsNumber)} />
      </label>
      <label class="ui-lab-control-row ui-lab-control-row--stacked">
        <span>Action Label</span>
        <select class="ui-lab-input" value={contentFormat(props.source.slots.primaryAction.label)} onChange={(event) => replaceActionFormat(event.currentTarget.value as 'plain' | 'cruel-markup-v1')}>
          <option value="plain">Plain text</option>
          <option value="cruel-markup-v1">Cruel markup v1</option>
        </select>
        <input class="ui-lab-input main-material-text-input" value={inlineValue(props.source.slots.primaryAction.label)} onInput={(event) => replaceActionLabel(event.currentTarget.value)} />
      </label>

      <SectionHeading label="Typography & Emboss" />
      <label class="ui-lab-control-row ui-lab-control-row--stacked">
        <span>Text target</span>
        <select class="ui-lab-input" value={selectedTypographyRole()} onChange={(event) => setSelectedTypographyRole(event.currentTarget.value as MissionTypographyRoleId)}>
          <For each={missionTypographyRoleIds}>{(role) => <option value={role}>{role}</option>}</For>
        </select>
      </label>
      <label class="ui-lab-control-row ui-lab-control-row--stacked">
        <span>Rich-text role</span>
        <select class="ui-lab-input" value={selectedTypographyVariant()} onChange={(event) => setSelectedTypographyVariant(event.currentTarget.value as MissionTypographyVariantId)}>
          <For each={missionTypographyVariantIds}>{(variant) => <option value={variant}>{variant}</option>}</For>
        </select>
      </label>
      <label class="ui-lab-control-row ui-lab-control-row--stacked">
        <span>Font</span>
        <select class="ui-lab-input" value={selectedTypographyStyle().fontFamily} onChange={(event) => updateTypographyStyle({ fontFamily: event.currentTarget.value })}>
          <For each={missionFontOptions}>{(font) => <option value={font.value}>{font.label}</option>}</For>
        </select>
      </label>
      <label class="ui-lab-control-row"><span>Color</span><input type="color" value={selectedTypographyStyle().color} onInput={(event) => updateTypographyStyle({ color: event.currentTarget.value })} /></label>
      <label class="ui-lab-control-row"><span>Size cqw</span><input type="range" min="0.4" max="12" step="0.1" value={selectedTypographyStyle().sizeCqw} onInput={(event) => updateTypographyStyle({ sizeCqw: event.currentTarget.valueAsNumber })} /><output>{selectedTypographyStyle().sizeCqw}</output></label>
      <label class="ui-lab-control-row"><span>Weight</span><input type="range" min="100" max="900" step="100" value={selectedTypographyStyle().weight} onInput={(event) => updateTypographyStyle({ weight: event.currentTarget.valueAsNumber })} /><output>{selectedTypographyStyle().weight}</output></label>
      <label class="ui-lab-control-row"><span>Line height</span><input type="range" min="0.6" max="2.5" step="0.02" value={selectedTypographyStyle().lineHeight} onInput={(event) => updateTypographyStyle({ lineHeight: event.currentTarget.valueAsNumber })} /><output>{selectedTypographyStyle().lineHeight}</output></label>
      <label class="ui-lab-control-row"><span>Tracking em</span><input type="range" min="-0.1" max="0.3" step="0.005" value={selectedTypographyStyle().letterSpacingEm} onInput={(event) => updateTypographyStyle({ letterSpacingEm: event.currentTarget.valueAsNumber })} /><output>{selectedTypographyStyle().letterSpacingEm}</output></label>
      <label class="ui-lab-control-row ui-lab-control-row--stacked"><span>Emboss / shadow</span><select class="ui-lab-input" value={selectedTypographyStyle().embossMode} onChange={(event) => updateTypographyStyle({ embossMode: event.currentTarget.value as MissionTextStyleV1['embossMode'] })}><option value="none">None</option><option value="dark">Dark emboss</option><option value="light">Light emboss</option><option value="shadow">Drop shadow</option></select></label>
      <label class="ui-lab-control-row"><span>Strength</span><input type="range" min="0" max="100" value={selectedTypographyStyle().embossStrength} onInput={(event) => updateTypographyStyle({ embossStrength: event.currentTarget.valueAsNumber })} /><output>{selectedTypographyStyle().embossStrength}</output></label>
      <label class="ui-lab-control-row"><span>Offset</span><input type="range" min="0" max="100" value={selectedTypographyStyle().embossOffset} onInput={(event) => updateTypographyStyle({ embossOffset: event.currentTarget.valueAsNumber })} /><output>{selectedTypographyStyle().embossOffset}</output></label>
      <label class="ui-lab-control-row"><span>Blur</span><input type="range" min="0" max="100" value={selectedTypographyStyle().embossBlur} onInput={(event) => updateTypographyStyle({ embossBlur: event.currentTarget.valueAsNumber })} /><output>{selectedTypographyStyle().embossBlur}</output></label>

      <SectionHeading label="Required Function" />
      <For each={missionBriefingRequiredSlots}>
        {(slot) => (
          <div class="ui-lab-control-row">
            <span>{slotLabels[slot]}</span>
            <button type="button" class="ui-lab-mini-button" onClick={() => props.onCommand({ type: 'slot/remove', slot })}>test remove</button>
          </div>
        )}
      </For>

      <SectionHeading label="Optional Slots" />
      <For each={presentOptionalSlots()}>
        {(slot) => (
          <div class="ui-lab-control-row">
            <span>{slotLabels[slot]}</span>
            <button type="button" class="ui-lab-mini-button" onClick={() => props.onCommand({ type: 'slot/remove', slot })}>hide</button>
          </div>
        )}
      </For>
      <For each={missingOptionalSlots()}>
        {(slot) => (
          <div class="ui-lab-control-row">
            <span>{slotLabels[slot]}</span>
            <button type="button" class="ui-lab-mini-button" onClick={() => restoreOptional(slot)}>restore</button>
          </div>
        )}
      </For>

      <SectionHeading label="Appearance Parts" />
      <div class="ui-lab-control-row">
        <For each={(['panel', 'terms', 'primaryAction'] as AppearancePartId[])}>
          {(part) => <button type="button" class="ui-lab-mini-button" aria-pressed={selectedPart() === part} onClick={() => setSelectedPart(part)}>{partLabels[part]}</button>}
        </For>
      </div>
      <For each={selectedGraphs()}>
        {(graph) => (
          <div class="ui-lab-control-row ui-lab-control-row--stacked" data-appearance-graph={graph.id}>
            <code>{graph.state}</code>
            <For each={graph.layers}>
              {(layer, index) => (
                <div class="ui-lab-control-row ui-lab-control-row--stacked" data-paint-layer={layer.id}>
                  <div class="ui-lab-control-row">
                    <span>{layer.id} · {layer.type}</span>
                    <button type="button" class="ui-lab-mini-button" onClick={() => updateLayer(graph.id, layer.id, (current) => ({ ...current, enabled: !current.enabled }))}>{layer.enabled ? 'on' : 'off'}</button>
                    <button type="button" class="ui-lab-mini-button" disabled={index() === 0} onClick={() => moveLayer(graph.id, index(), -1)}>↑</button>
                    <button type="button" class="ui-lab-mini-button" disabled={index() === graph.layers.length - 1} onClick={() => moveLayer(graph.id, index(), 1)}>↓</button>
                  </div>
                  <Show when={layer.type === 'backdropGlass'}>
                    <label class="ui-lab-control-row"><span>Blur px</span><input type="range" min="0" max="32" value={(layer as Extract<PaintLayerSourceV1, { type: 'backdropGlass' }>).blurPx} onInput={(event) => updateLayer(graph.id, layer.id, (current) => current.type === 'backdropGlass' ? { ...current, blurPx: event.currentTarget.valueAsNumber } : current)} /></label>
                  </Show>
                  <Show when={layer.type === 'reflection' || layer.type === 'glow'}>
                    <label class="ui-lab-control-row"><span>Opacity</span><input type="range" min="0" max="1" step="0.01" value={(layer as Extract<PaintLayerSourceV1, { type: 'reflection' | 'glow' }>).opacity} onInput={(event) => updateLayer(graph.id, layer.id, (current) => (current.type === 'reflection' || current.type === 'glow') ? { ...current, opacity: event.currentTarget.valueAsNumber } : current)} /></label>
                  </Show>
                  <Show when={layer.type === 'edgeWear'}>
                    <label class="ui-lab-control-row ui-lab-control-row--stacked"><span>Rough edge</span><select class="ui-lab-input" value={(layer as Extract<PaintLayerSourceV1, { type: 'edgeWear' }>).variant} onChange={(event) => updateLayer(graph.id, layer.id, (current) => current.type === 'edgeWear' ? { ...current, variant: event.currentTarget.value as Extract<PaintLayerSourceV1, { type: 'edgeWear' }>['variant'] } : current)}><option value="edge-chips">Edge chips</option><option value="edge-noise">Edge noise</option><option value="fine-scratches">Fine scratches</option></select></label>
                    <label class="ui-lab-control-row"><span>Opacity</span><input type="range" min="0" max="1" step="0.01" value={(layer as Extract<PaintLayerSourceV1, { type: 'edgeWear' }>).opacity} onInput={(event) => updateLayer(graph.id, layer.id, (current) => current.type === 'edgeWear' ? { ...current, opacity: event.currentTarget.valueAsNumber } : current)} /></label>
                    <label class="ui-lab-control-row"><span>Width</span><input type="range" min="0.5" max="8" step="0.1" value={(layer as Extract<PaintLayerSourceV1, { type: 'edgeWear' }>).widthPx} onInput={(event) => updateLayer(graph.id, layer.id, (current) => current.type === 'edgeWear' ? { ...current, widthPx: event.currentTarget.valueAsNumber } : current)} /></label>
                    <label class="ui-lab-control-row"><span>Scale</span><input type="range" min="2" max="64" step="1" value={(layer as Extract<PaintLayerSourceV1, { type: 'edgeWear' }>).scalePx} onInput={(event) => updateLayer(graph.id, layer.id, (current) => current.type === 'edgeWear' ? { ...current, scalePx: event.currentTarget.valueAsNumber } : current)} /></label>
                  </Show>
                </div>
              )}
            </For>
          </div>
        )}
      </For>

      <div class="ui-lab-control-row ui-lab-control-row--stacked" aria-live="polite">
        <span>Command Result</span>
        <code>{props.status}</code>
      </div>

      <SectionHeading label="Canonical Source" />
      <textarea class="ui-lab-input main-material-text-input main-material-markup-input" value={serialized()} readOnly aria-label="Canonical Mission Briefing source" />
      <button type="button" class="ui-lab-mini-button" onClick={() => props.onCopy(serialized())}>copy canonical source</button>
      <SectionHeading label="Canonical Appearance" />
      <textarea class="ui-lab-input main-material-text-input main-material-markup-input" value={serializedAppearance()} readOnly aria-label="Canonical Mission appearance" />
      <button type="button" class="ui-lab-mini-button" onClick={() => props.onCopyAppearance(serializedAppearance())}>copy canonical appearance</button>
    </div>
  );
};

const SectionHeading = (props: { label: string }) => (
  <div class="ui-lab-section-label ui-lab-section-label--xs">{props.label}</div>
);
