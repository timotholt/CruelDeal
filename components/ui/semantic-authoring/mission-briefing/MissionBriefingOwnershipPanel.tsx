import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';
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
import {
  paintCornerIds,
  paintTextureOptions,
  type PaintCornerId,
  type PaintTextureId,
  type AppearanceGraphSourceV1,
  type AppearancePartId,
  type MissionAppearanceDocumentV1,
  type PaintLayerSourceV1,
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
import { controlRange } from '../../semantic-compiler/controls/authoringControlRegistry';

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
const cornerLabels: Record<PaintCornerId, string> = {
  'top-left': 'TL',
  'top-right': 'TR',
  'bottom-right': 'BR',
  'bottom-left': 'BL',
};

const RegistryRangeInput = (props: {
  ruleId: string;
  value: number;
  onValue: (value: number) => void;
}) => {
  const range = createMemo(() => controlRange(props.ruleId));
  return (
    <input
      type="range"
      min={range().min}
      max={range().max}
      step={range().step}
      value={props.value}
      data-control-rule={props.ruleId}
      onInput={(event) => props.onValue(event.currentTarget.valueAsNumber)}
    />
  );
};

export const MissionBriefingOwnershipPanel = (props: {
  source: MissionBriefingSourceV1;
  defaults: MissionBriefingSourceV1;
  appearance: MissionAppearanceDocumentV1;
  focusPart?: AppearancePartId | null;
  status: string;
  canUndo: boolean;
  canRedo: boolean;
  compiled: boolean;
  onCommand: (command: MissionBriefingCommand) => MissionBriefingCommandResult;
  onAppearanceChange: (appearance: MissionAppearanceDocumentV1) => void;
  onFocusPartChange?: (part: AppearancePartId) => void;
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
  const focusedPart = () => props.focusPart ?? null;
  const activePart = () => focusedPart() ?? selectedPart();
  const showPart = (part: AppearancePartId) => focusedPart() === null || focusedPart() === part;
  const selectPart = (part: AppearancePartId) => {
    setSelectedPart(part);
    props.onFocusPartChange?.(part);
  };
  const typographyRolesForPart = (): MissionTypographyRoleId[] => {
    if (focusedPart() === 'terms') return ['termLabel', 'termValue'];
    if (focusedPart() === 'primaryAction') return ['actionLabel'];
    if (focusedPart() === 'panel') return ['title', 'body', 'availability'];
    return [...missionTypographyRoleIds];
  };
  const focusLabel = () => {
    const part = focusedPart();
    return part ? partLabels[part] : 'Overview';
  };
  createEffect(() => {
    const roles = typographyRolesForPart();
    if (!roles.includes(selectedTypographyRole())) setSelectedTypographyRole(roles[0]);
  });
  const selectedGraphs = () => props.appearance.graphs.filter((graph) => graph.part === activePart());
  const activeGeometry = () => (
    activePart() === 'panel' ? selectedGraphs()[0]?.geometry : undefined
  );
  const activeChamferCorners = (): PaintCornerId[] => {
    const geometry = activeGeometry();
    if (!geometry || geometry.clip !== 'mission-chamfer') return [];
    return geometry.chamferCorners ?? [...paintCornerIds];
  };

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
  const updateActiveGeometry = (update: (geometry: AppearanceGraphSourceV1['geometry']) => AppearanceGraphSourceV1['geometry']) => {
    props.onAppearanceChange({
      ...props.appearance,
      graphs: props.appearance.graphs.map((graph) => (
        graph.part === activePart() ? { ...graph, geometry: update(graph.geometry) } : graph
      )),
    });
  };
  const toggleChamferCorner = (corner: PaintCornerId) => {
    const current = activeChamferCorners();
    const next = current.includes(corner)
      ? current.filter((value) => value !== corner)
      : paintCornerIds.filter((value) => current.includes(value) || value === corner);
    updateActiveGeometry((geometry) => ({
      ...geometry,
      clip: next.length ? 'mission-chamfer' : 'rounded-rect',
      radiusPx: geometry.radiusPx || 8,
      chamferPx: geometry.chamferPx || 18,
      chamferCorners: next,
    }));
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
    <div class="ui-lab-stack" data-semantic-editor="MissionBriefingV2" data-selected-appearance-part={focusedPart() ?? 'overview'}>
      <SectionHeading label={`Mission Briefing V2 · ${focusLabel()}`} />
      <div class="ui-lab-control-row ui-lab-control-row--stacked">
        <span>Ownership</span>
        <code>Semantic source → compiler → runtime</code>
        <span>The legacy Feed node, binding, layout, and content controls are disabled for this component.</span>
      </div>

      <SectionHeading label="Workflow" />
      <div class="ui-lab-control-row">
        <button type="button" class="ui-lab-mini-button" disabled={!props.canUndo} onClick={() => props.onUndo()}>undo</button>
        <button type="button" class="ui-lab-mini-button" disabled={!props.canRedo} onClick={() => props.onRedo()}>redo</button>
      </div>
      <div class="ui-lab-control-row">
        <button type="button" class="ui-lab-mini-button" onClick={() => props.onCompile()}>compile</button>
        <button type="button" class="ui-lab-mini-button" disabled={!props.compiled} onClick={() => props.onReturnToLive()}>return live</button>
      </div>

      <SectionHeading label="Content" />
      <Show when={showPart('panel')}>
        <>
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
        </>
      </Show>
      <Show when={showPart('terms')}>
        <>
      <label class="ui-lab-control-row">
        <span>Deposit CR</span>
        <input type="number" min="0" class="ui-lab-input main-material-text-input" value={'literal' in (props.source.slots.terms.deposit?.amount ?? { literal: 0 }) ? (props.source.slots.terms.deposit?.amount as { literal: number }).literal : 0} onInput={(event) => replaceTermsAmount('deposit', event.currentTarget.valueAsNumber)} />
      </label>
      <label class="ui-lab-control-row">
        <span>Success CR</span>
        <input type="number" min="0" class="ui-lab-input main-material-text-input" value={'literal' in props.source.slots.terms.successReward.amount ? props.source.slots.terms.successReward.amount.literal : 0} onInput={(event) => replaceTermsAmount('successReward', event.currentTarget.valueAsNumber)} />
      </label>
        </>
      </Show>
      <Show when={showPart('primaryAction')}>
      <label class="ui-lab-control-row ui-lab-control-row--stacked">
        <span>Action Label</span>
        <select class="ui-lab-input" value={contentFormat(props.source.slots.primaryAction.label)} onChange={(event) => replaceActionFormat(event.currentTarget.value as 'plain' | 'cruel-markup-v1')}>
          <option value="plain">Plain text</option>
          <option value="cruel-markup-v1">Cruel markup v1</option>
        </select>
        <input class="ui-lab-input main-material-text-input" value={inlineValue(props.source.slots.primaryAction.label)} onInput={(event) => replaceActionLabel(event.currentTarget.value)} />
      </label>
      </Show>

      <SectionHeading label="Typography & Emboss" />
      <label class="ui-lab-control-row ui-lab-control-row--stacked">
        <span>Text target</span>
        <select class="ui-lab-input" value={selectedTypographyRole()} onChange={(event) => setSelectedTypographyRole(event.currentTarget.value as MissionTypographyRoleId)}>
          <For each={typographyRolesForPart()}>{(role) => <option value={role}>{role}</option>}</For>
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
      <label class="ui-lab-control-row"><span>Size cqw</span><RegistryRangeInput ruleId="type.fontSize" value={selectedTypographyStyle().sizeCqw} onValue={(value) => updateTypographyStyle({ sizeCqw: value })} /><output>{selectedTypographyStyle().sizeCqw}</output></label>
      <label class="ui-lab-control-row"><span>Weight</span><RegistryRangeInput ruleId="type.weight" value={selectedTypographyStyle().weight} onValue={(value) => updateTypographyStyle({ weight: value })} /><output>{selectedTypographyStyle().weight}</output></label>
      <label class="ui-lab-control-row"><span>Line height</span><RegistryRangeInput ruleId="type.lineHeight" value={selectedTypographyStyle().lineHeight} onValue={(value) => updateTypographyStyle({ lineHeight: value })} /><output>{selectedTypographyStyle().lineHeight}</output></label>
      <label class="ui-lab-control-row"><span>Tracking em</span><RegistryRangeInput ruleId="type.letterSpacing" value={selectedTypographyStyle().letterSpacingEm} onValue={(value) => updateTypographyStyle({ letterSpacingEm: value })} /><output>{selectedTypographyStyle().letterSpacingEm}</output></label>
      <label class="ui-lab-control-row ui-lab-control-row--stacked"><span>Emboss / shadow</span><select class="ui-lab-input" value={selectedTypographyStyle().embossMode} onChange={(event) => updateTypographyStyle({ embossMode: event.currentTarget.value as MissionTextStyleV1['embossMode'] })}><option value="none">None</option><option value="dark">Dark emboss</option><option value="light">Light emboss</option><option value="shadow">Drop shadow</option></select></label>
      <label class="ui-lab-control-row"><span>Strength</span><RegistryRangeInput ruleId="type.embossStrength" value={selectedTypographyStyle().embossStrength} onValue={(value) => updateTypographyStyle({ embossStrength: value })} /><output>{selectedTypographyStyle().embossStrength}</output></label>
      <label class="ui-lab-control-row"><span>Offset</span><RegistryRangeInput ruleId="type.embossOffset" value={selectedTypographyStyle().embossOffset} onValue={(value) => updateTypographyStyle({ embossOffset: value })} /><output>{selectedTypographyStyle().embossOffset}</output></label>
      <label class="ui-lab-control-row"><span>Blur</span><RegistryRangeInput ruleId="type.embossBlur" value={selectedTypographyStyle().embossBlur} onValue={(value) => updateTypographyStyle({ embossBlur: value })} /><output>{selectedTypographyStyle().embossBlur}</output></label>

      <Show when={focusedPart() === null}>
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
      </Show>

      <SectionHeading label="Appearance Parts" />
      <div class="ui-lab-control-row">
        <For each={(['panel', 'terms', 'primaryAction'] as AppearancePartId[])}>
          {(part) => <button type="button" class="ui-lab-mini-button" aria-pressed={activePart() === part} onClick={() => selectPart(part)}>{partLabels[part]}</button>}
        </For>
      </div>
      <Show when={activeGeometry()}>
        {(geometry) => (
          <>
            <SectionHeading label="Corner Shape" />
            <div class="ui-lab-control-row">
              <span>Slanted</span>
              <For each={paintCornerIds}>
                {(corner) => (
                  <button
                    type="button"
                    class="ui-lab-mini-button"
                    aria-pressed={activeChamferCorners().includes(corner)}
                    onClick={() => toggleChamferCorner(corner)}
                  >
                    {cornerLabels[corner]}
                  </button>
                )}
              </For>
            </div>
            <label class="ui-lab-control-row"><span>Round radius</span><RegistryRangeInput ruleId="paint.geometry.radiusPx" value={geometry().radiusPx} onValue={(value) => updateActiveGeometry((current) => ({ ...current, radiusPx: value }))} /><output>{geometry().radiusPx}</output></label>
            <label class="ui-lab-control-row"><span>Slant size</span><RegistryRangeInput ruleId="paint.geometry.chamferPx" value={geometry().chamferPx} onValue={(value) => updateActiveGeometry((current) => ({ ...current, chamferPx: value }))} /><output>{geometry().chamferPx}</output></label>
          </>
        )}
      </Show>
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
                    <label class="ui-lab-control-row"><span>Blur px</span><RegistryRangeInput ruleId="paint.glass.blurPx" value={(layer as Extract<PaintLayerSourceV1, { type: 'backdropGlass' }>).blurPx} onValue={(value) => updateLayer(graph.id, layer.id, (current) => current.type === 'backdropGlass' ? { ...current, blurPx: value } : current)} /></label>
                  </Show>
                  <Show when={layer.type === 'reflection' || layer.type === 'glow'}>
                    <label class="ui-lab-control-row"><span>Opacity</span><RegistryRangeInput ruleId="paint.layer.opacity" value={(layer as Extract<PaintLayerSourceV1, { type: 'reflection' | 'glow' }>).opacity} onValue={(value) => updateLayer(graph.id, layer.id, (current) => (current.type === 'reflection' || current.type === 'glow') ? { ...current, opacity: value } : current)} /></label>
                  </Show>
                  <Show when={layer.type === 'texture'}>
                    <label class="ui-lab-control-row ui-lab-control-row--stacked">
                      <span>Texture Picker</span>
                      <select
                        class="ui-lab-input"
                        value={(layer as Extract<PaintLayerSourceV1, { type: 'texture' }>).texture}
                        onChange={(event) => updateLayer(graph.id, layer.id, (current) => {
                          if (current.type !== 'texture') return current;
                          const texture = event.currentTarget.value as PaintTextureId;
                          const procedural = texture === 'hex-grid' || texture === 'fine-noise';
                          return {
                            ...current,
                            texture,
                            scalePx: procedural ? Math.min(current.scalePx, 96) : Math.max(current.scalePx, 256),
                          };
                        })}
                      >
                        <For each={paintTextureOptions}>{(texture) => <option value={texture.id}>{texture.label}</option>}</For>
                      </select>
                    </label>
                    <label class="ui-lab-control-row"><span>Texture opacity</span><RegistryRangeInput ruleId="paint.layer.opacity" value={(layer as Extract<PaintLayerSourceV1, { type: 'texture' }>).opacity} onValue={(value) => updateLayer(graph.id, layer.id, (current) => current.type === 'texture' ? { ...current, opacity: value } : current)} /><output>{(layer as Extract<PaintLayerSourceV1, { type: 'texture' }>).opacity}</output></label>
                    <label class="ui-lab-control-row"><span>Texture scale</span><RegistryRangeInput ruleId="paint.texture.scalePx" value={(layer as Extract<PaintLayerSourceV1, { type: 'texture' }>).scalePx} onValue={(value) => updateLayer(graph.id, layer.id, (current) => current.type === 'texture' ? { ...current, scalePx: value } : current)} /><output>{(layer as Extract<PaintLayerSourceV1, { type: 'texture' }>).scalePx}</output></label>
                  </Show>
                  <Show when={layer.type === 'edgeWear'}>
                    <label class="ui-lab-control-row ui-lab-control-row--stacked"><span>Rough edge</span><select class="ui-lab-input" value={(layer as Extract<PaintLayerSourceV1, { type: 'edgeWear' }>).variant} onChange={(event) => updateLayer(graph.id, layer.id, (current) => current.type === 'edgeWear' ? { ...current, variant: event.currentTarget.value as Extract<PaintLayerSourceV1, { type: 'edgeWear' }>['variant'] } : current)}><option value="edge-chips">Edge chips</option><option value="edge-noise">Edge noise</option><option value="fine-scratches">Fine scratches</option></select></label>
                    <label class="ui-lab-control-row"><span>Opacity</span><RegistryRangeInput ruleId="paint.layer.opacity" value={(layer as Extract<PaintLayerSourceV1, { type: 'edgeWear' }>).opacity} onValue={(value) => updateLayer(graph.id, layer.id, (current) => current.type === 'edgeWear' ? { ...current, opacity: value } : current)} /></label>
                    <label class="ui-lab-control-row"><span>Width</span><RegistryRangeInput ruleId="paint.edgeWear.widthPx" value={(layer as Extract<PaintLayerSourceV1, { type: 'edgeWear' }>).widthPx} onValue={(value) => updateLayer(graph.id, layer.id, (current) => current.type === 'edgeWear' ? { ...current, widthPx: value } : current)} /></label>
                    <label class="ui-lab-control-row"><span>Scale</span><RegistryRangeInput ruleId="paint.edgeWear.scalePx" value={(layer as Extract<PaintLayerSourceV1, { type: 'edgeWear' }>).scalePx} onValue={(value) => updateLayer(graph.id, layer.id, (current) => current.type === 'edgeWear' ? { ...current, scalePx: value } : current)} /></label>
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
