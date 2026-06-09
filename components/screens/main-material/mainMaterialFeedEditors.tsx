import { createSignal, For, Show } from 'solid-js';
import {
  SectionLabel,
  materialRecipeContentTones,
  materialRecipeFontStyles,
  materialRecipeTextAligns,
  materialRecipeTextFonts,
  materialRecipeTextTransforms,
  type FontStyleToken,
  type FontWeightToken,
  type MaterialTone,
} from '../../ui/material-lab';
import {
  resolveLayoutConstraintH,
  resolveLayoutConstraintV,
  resolveLayoutCrossAlign,
  resolveLayoutDirection,
  resolveLayoutDistribute,
  resolveLayoutHMode,
  resolveLayoutPushToEnd,
  resolveLayoutSelfPosition,
  resolveLayoutWMode,
  type FeedNodeAlign,
  type FeedNodeConstraintH,
  type FeedNodeConstraintV,
  type FeedNodeCrossAlign,
  type FeedNodeDirection,
  type FeedNodeDistribute,
  type FeedNodeJustify,
  type FeedNodeLayout,
} from './feedNodeLayoutCss';
import {
  feedDefaultTextFontCondensed,
  cloneFeedCardType,
  createFeedNode,
  createFeedNodeLayout,
  createFeedRegionSurface,
  feedMediaFadeLabels,
  feedMediaFadeModes,
  feedTextSlotIds,
  feedTextSlotLabels,
  type FeedBackgroundImageRecipe,
  type FeedCardNode,
  type FeedCardTypes,
  type FeedCardTypeId,
  type FeedCardTypeRecipe,
  type FeedMediaFadeMode,
  type FeedStory,
  type FeedTextSlotId,
  type FeedTextSlotStyle,
  type FeedTextTransformToken,
} from './mainMaterialFeedModel';
import {
  createLocalTextOverrideStyle,
  legacyMarkupMode,
  legacySizingMode,
  feedTextHasMarkup,
  resolveFeedNodeFit,
  resolveFeedNodeTextEditorStyle,
  resolveFeedNodeTextStyle,
} from './mainMaterialFeedText';
import { MiniButton, Slider } from './mainMaterialEditorPrimitives';
import { findTreeNodeById, updateTreeNodeById } from './mainMaterialTargetTree';
import {
  feedCardMaterialTargetId,
  feedMaterialTargetIdForNode,
  parseFeedMaterialTargetId,
} from './materialTargetIds';
import {
  duplicateFeedNode,
  insertFeedNode,
  insertFeedNodeAfter,
  moveFeedNodeByOffset,
  removeFeedNode,
  unwrapFeedNodeContainer,
  wrapFeedNodesInContainer,
  type FeedNodeIdFactory,
  type FeedNodeTreeOperationResult,
} from './mainMaterialNodeTreeOperations';
import {
  createRewardTermsGroupNode,
  createTextBlockNode,
  createTwoColumnGroupNode,
} from './mainMaterialNodeTemplates';

export interface FeedRecipe {
  contentY: number;
  cardGap: number;
  newsGap: number;
}

const layoutPackedDistributes = ['start', 'center', 'end'] as const;
const layoutDistributeModes = ['packed', 'between', 'around', 'evenly'] as const;
const layoutCrossPositions = ['start', 'center', 'end'] as const;
type LayoutDistributeMode = typeof layoutDistributeModes[number];

interface StructureUndoSnapshot {
  label: string;
  cardType: FeedCardTypeRecipe;
  selectedMaterialTargetId: string;
}

export const FeedRecipeEditor = (props: {
  feed: FeedRecipe;
  onChange: (feed: FeedRecipe) => void;
  stories: FeedStory[];
  selectedStoryId: string;
  onSelectedStoryIdChange: (storyId: string) => void;
  onStoryTextChange: (storyId: string, slotId: FeedTextSlotId, value: string) => void;
  cardTypes: FeedCardTypes;
  editingCardTypeId: FeedCardTypeId;
  selectedMaterialTargetId: string;
  onSelectedMaterialTargetIdChange: (targetId: string) => void;
  storyImageOverrides: Record<string, string>;
  onStoryImageOverrideChange: (storyId: string, image: string | null) => void;
  selectedStoryContentJson: string;
  onCopySelectedStoryContentJson: () => void;
  onCardTypeChange: (cardType: FeedCardTypeRecipe) => void;
}) => {
  const [insertMode, setInsertMode] = createSignal<'inside' | 'after'>('inside');
  const [structureUndo, setStructureUndo] = createSignal<StructureUndoSnapshot | null>(null);
  const [structureStatus, setStructureStatus] = createSignal('Ready');
  const update = <K extends keyof FeedRecipe>(key: K, value: FeedRecipe[K]) => {
    props.onChange({ ...props.feed, [key]: value });
  };
  const selectedStory = () => props.stories.find((story) => story.id === props.selectedStoryId) || props.stories[0];
  const selectedStoryImage = () => props.storyImageOverrides[selectedStory().id] || selectedStory().image;
  const selectedNodeStoryText = () => {
    const binding = selectedTargetNode()?.binding;
    return binding ? selectedStory()[binding] || '' : '';
  };
  const selectedNodeCmsState = () => selectedTargetNode()?.binding ? 'bound' : 'static';
  const selectedNodeFieldKind = () => {
    const node = selectedTargetNode();
    if (!node?.binding) return node?.type === 'button' ? 'static button text' : 'static node';
    const value = selectedNodeStoryText();
    if (node.type === 'button') return 'button label';
    return feedTextHasMarkup(value) ? 'rich markup' : 'plain text';
  };
  const selectedNodeStoryTextPreview = () => {
    const value = selectedNodeStoryText().replace(/\s+/g, ' ').trim();
    if (!value) return 'empty';
    return value.length > 96 ? `${value.slice(0, 96)}...` : value;
  };
  const editingCardType = () => props.cardTypes[props.editingCardTypeId];
  const selectedFeedTarget = () => parseFeedMaterialTargetId<FeedCardTypeId>(props.selectedMaterialTargetId);
  const selectedTargetNode = () => {
    const target = selectedFeedTarget();
    return target?.nodeId ? findTreeNodeById(editingCardType().children, target.nodeId) : undefined;
  };
  const isEditingChildNode = () => Boolean(selectedTargetNode());
  const isEditingCardRoot = () => !isEditingChildNode();
  const updateEditingCardType = (updates: Partial<FeedCardTypeRecipe>) => {
    props.onCardTypeChange({ ...editingCardType(), ...updates });
  };
  const updateBackground = <K extends keyof FeedBackgroundImageRecipe>(key: K, value: FeedBackgroundImageRecipe[K]) => {
    updateEditingCardType({
      backgroundImage: {
        ...editingCardType().backgroundImage,
        [key]: value,
      },
    });
  };
  const updateSelectedNode = (updates: Partial<FeedCardNode>) => {
    const node = selectedTargetNode();
    if (!node) return;
    updateEditingCardType({
      children: updateTreeNodeById(editingCardType().children, node.id, (current) => ({ ...current, ...updates })),
    });
  };
  const collectNodeIds = (nodes: readonly FeedCardNode[], ids = new Set<string>()): Set<string> => {
    nodes.forEach((node) => {
      ids.add(node.id);
      collectNodeIds(node.children || [], ids);
    });
    return ids;
  };
  const uniqueNodeId = (base: string) => {
    const existing = collectNodeIds(editingCardType().children);
    const normalized = base
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'node';
    let next = normalized;
    let suffix = 2;
    while (existing.has(next)) {
      next = `${normalized}-${suffix}`;
      suffix += 1;
    }
    return next;
  };
  const createDuplicateIdFactory = () => {
    const existing = collectNodeIds(editingCardType().children);
    const issued = new Set<string>();
    const factory: FeedNodeIdFactory = (sourceId) => {
      const normalized = `${sourceId}-copy`;
      let next = normalized;
      let suffix = 2;
      while (existing.has(next) || issued.has(next)) {
        next = `${normalized}-${suffix}`;
        suffix += 1;
      }
      issued.add(next);
      return next;
    };
    return factory;
  };
  const selectFeedNode = (nodeId: string) => {
    props.onSelectedMaterialTargetIdChange(feedMaterialTargetIdForNode(props.editingCardTypeId, nodeId));
  };
  const selectCardRoot = () => {
    props.onSelectedMaterialTargetIdChange(feedCardMaterialTargetId(props.editingCardTypeId));
  };
  const applyNodeTreeOperation = (
    result: FeedNodeTreeOperationResult,
    selectNodeId?: string,
    label = 'Updated structure',
  ) => {
    if (!result.ok) {
      setStructureStatus(result.reason);
      return;
    }
    setStructureUndo({
      label,
      cardType: cloneFeedCardType(editingCardType()),
      selectedMaterialTargetId: props.selectedMaterialTargetId,
    });
    updateEditingCardType({ children: result.nodes });
    if (selectNodeId) selectFeedNode(selectNodeId);
    setStructureStatus(label);
  };
  const undoStructureOperation = () => {
    const snapshot = structureUndo();
    if (!snapshot) return;
    props.onCardTypeChange(snapshot.cardType);
    props.onSelectedMaterialTargetIdChange(snapshot.selectedMaterialTargetId);
    setStructureUndo(null);
    setStructureStatus(`Undid ${snapshot.label.toLowerCase()}`);
  };
  const selectedInsertMode = () => {
    const node = selectedTargetNode();
    if (!node) return 'inside';
    return node.type === 'container' ? insertMode() : 'after';
  };
  const insertNodeFromStructure = (node: FeedCardNode, selectNodeId: string) => {
    const selectedNode = selectedTargetNode();
    const result = selectedNode && selectedInsertMode() === 'after'
      ? insertFeedNodeAfter(editingCardType().children, selectedNode.id, node)
      : insertFeedNode(editingCardType().children, selectedInsertParentId(), node);
    applyNodeTreeOperation(result, selectNodeId, `Added ${node.label}`);
  };
  const selectedInsertParentId = () => {
    const node = selectedTargetNode();
    return node?.type === 'container' ? node.id : null;
  };
  const addTextBlockNode = () => {
    const id = uniqueNodeId('text-block');
    insertNodeFromStructure(createTextBlockNode(id, 'Text Block', 'contractBody'), id);
  };
  const addSurfacePanelNode = () => {
    const id = uniqueNodeId('surface-panel');
    insertNodeFromStructure(
      createFeedNode({
        id,
        label: 'Surface Panel',
        type: 'container',
        surface: createFeedRegionSurface(),
        layout: createFeedNodeLayout({
          mode: 'flow',
          selfPosition: 'in-flow',
          direction: 'column',
          width: 100,
          height: 18,
          wMode: 'fill',
          hMode: 'hug',
          padding: 10,
          gap: 8,
        }),
      }),
      id,
    );
  };
  const addRewardTermsTemplate = () => {
    const id = uniqueNodeId('reward-terms-group');
    insertNodeFromStructure(createRewardTermsGroupNode(id), id);
  };
  const duplicateSelectedNode = () => {
    const node = selectedTargetNode();
    if (!node) return;
    let duplicateId = '';
    const factory = createDuplicateIdFactory();
    const trackingFactory: FeedNodeIdFactory = (sourceId) => {
      const nextId = factory(sourceId);
      if (sourceId === node.id) duplicateId = nextId;
      return nextId;
    };
    applyNodeTreeOperation(duplicateFeedNode(editingCardType().children, node.id, trackingFactory), duplicateId, `Duplicated ${node.label}`);
  };
  const moveSelectedNode = (offset: -1 | 1) => {
    const node = selectedTargetNode();
    if (!node) return;
    applyNodeTreeOperation(moveFeedNodeByOffset(editingCardType().children, node.id, offset), node.id, `Moved ${node.label} ${offset < 0 ? 'up' : 'down'}`);
  };
  const deleteSelectedNode = () => {
    const node = selectedTargetNode();
    if (!node) return;
    const childCount = node.children?.length || 0;
    const detail = childCount > 0 ? ` and its ${childCount} child node${childCount === 1 ? '' : 's'}` : '';
    if (!window.confirm(`Delete "${node.label}"${detail}?`)) return;
    applyNodeTreeOperation(removeFeedNode(editingCardType().children, node.id), undefined, `Deleted ${node.label}`);
    selectCardRoot();
  };
  const wrapSelectedNodeInGroup = () => {
    const node = selectedTargetNode();
    if (!node) return;
    const id = uniqueNodeId('node-group');
    applyNodeTreeOperation(
      wrapFeedNodesInContainer(editingCardType().children, [node.id], createFeedNode({
        id,
        label: 'Node Group',
        type: 'container',
        surface: createFeedRegionSurface(),
        layout: createFeedNodeLayout({
          mode: 'flow',
          selfPosition: 'in-flow',
          direction: 'column',
          width: 100,
          height: 18,
          wMode: 'fill',
          hMode: 'hug',
          padding: 0,
          gap: 8,
        }),
      })),
      id,
      `Wrapped ${node.label}`,
    );
  };
  const unwrapSelectedNode = () => {
    const node = selectedTargetNode();
    if (!node || node.type !== 'container') return;
    applyNodeTreeOperation(unwrapFeedNodeContainer(editingCardType().children, node.id), undefined, `Unwrapped ${node.label}`);
    selectCardRoot();
  };
  const updateSelectedNodeLayout = <K extends keyof FeedNodeLayout>(key: K, value: FeedNodeLayout[K]) => {
    const node = selectedTargetNode();
    if (!node) return;
    updateSelectedNode({
      layout: {
        ...node.layout,
        [key]: value,
      },
    });
  };
  const updateSelectedNodeLayoutFields = (updates: Partial<FeedNodeLayout>) => {
    const node = selectedTargetNode();
    if (!node) return;
    updateSelectedNode({
      layout: {
        ...node.layout,
        ...updates,
      },
    });
  };
  const updateSelectedNodeConstraintH = (constraintH: FeedNodeConstraintH) => {
    updateSelectedNodeLayoutFields({
      constraintH,
      ...(constraintH === 'center' ? { x: 0 } : {}),
    });
  };
  const updateSelectedNodeConstraintV = (constraintV: FeedNodeConstraintV) => {
    updateSelectedNodeLayoutFields({
      constraintV,
      ...(constraintV === 'center' ? { y: 0 } : {}),
    });
  };
  const selectedNodeCanEditText = () => {
    const node = selectedTargetNode();
    return Boolean(node?.binding) && (node?.type === 'text' || node?.type === 'button' || node?.type === 'container');
  };
  const selectedNodeCanBindContent = () => {
    const node = selectedTargetNode();
    return Boolean(node && (node.type === 'text' || node.type === 'button' || node.type === 'container'));
  };
  const updateSelectedNodeBinding = (binding: FeedTextSlotId | '') => {
    const node = selectedTargetNode();
    if (!node || !selectedNodeCanBindContent()) return;
    updateSelectedNode({ binding: binding || undefined });
    setStructureStatus(binding ? `Bound ${node.label} to ${feedTextSlotLabels[binding]}` : `Unbound ${node.label}`);
  };
  const selectedNodeTextMode = () => {
    const node = selectedTargetNode();
    return node && selectedNodeCanEditText() && node.text && !node.text.inherit ? 'custom' : 'inherit';
  };
  const updateSelectedNodeTextMode = (mode: 'inherit' | 'custom') => {
    const node = selectedTargetNode();
    if (!node || !selectedNodeCanEditText()) return;
    updateSelectedNode({
      text: mode === 'inherit'
        ? undefined
        : createLocalTextOverrideStyle(resolveFeedNodeTextStyle(editingCardType(), node)),
    });
  };
  const selectedNodeTextStyle = () => {
    const node = selectedTargetNode();
    return node && selectedNodeCanEditText() ? resolveFeedNodeTextEditorStyle(editingCardType(), node) : undefined;
  };
  const selectedNodeTextCustom = () => selectedNodeCanEditText() && selectedNodeTextMode() === 'custom';
  const selectedNodeRenderFitDisabled = () => {
    const node = selectedTargetNode();
    return Boolean(node && (resolveLayoutWMode(node.layout) === 'hug' || resolveLayoutHMode(node.layout) === 'hug'));
  };
  const layoutCrossToAlign = (cross: FeedNodeCrossAlign): FeedNodeAlign => (
    cross === 'end' ? 'right' : cross === 'center' || cross === 'stretch' ? 'center' : 'left'
  );
  const layoutCrossToJustify = (cross: FeedNodeCrossAlign): FeedNodeJustify => (
    cross === 'end' ? 'end' : cross === 'center' || cross === 'stretch' ? 'center' : 'start'
  );
  const layoutDistributeToAlign = (distribute: FeedNodeDistribute): FeedNodeAlign => (
    distribute === 'end' ? 'right' : distribute === 'center' ? 'center' : 'left'
  );
  const layoutDistributeToJustify = (distribute: FeedNodeDistribute): FeedNodeJustify => (
    distribute === 'end' ? 'end' : distribute === 'center' ? 'center' : 'start'
  );
  const layoutGridCell = (
    direction: FeedNodeDirection,
    visualRow: typeof layoutCrossPositions[number],
    visualColumn: typeof layoutCrossPositions[number],
  ): { cross: FeedNodeCrossAlign; distribute: FeedNodeDistribute } => (
    direction === 'column'
      ? { cross: visualColumn, distribute: visualRow }
      : { cross: visualRow, distribute: visualColumn }
  );
  const layoutGridCellLabel = (
    visualRow: typeof layoutCrossPositions[number],
    visualColumn: typeof layoutCrossPositions[number],
  ) => `${visualRow === 'start' ? 'T' : visualRow === 'center' ? 'M' : 'B'}${visualColumn === 'start' ? 'L' : visualColumn === 'center' ? 'C' : 'R'}`;
  const layoutDistributeMode = (distribute: FeedNodeDistribute): LayoutDistributeMode => (
    distribute === 'between' || distribute === 'around' || distribute === 'evenly' ? distribute : 'packed'
  );
  const legacyScreenAlignment = (
    direction: FeedNodeDirection,
    cross: FeedNodeCrossAlign,
    distribute: FeedNodeDistribute,
  ): Pick<FeedNodeLayout, 'align' | 'justify'> => (
    direction === 'column'
      ? { align: layoutCrossToAlign(cross), justify: layoutDistributeToJustify(distribute) }
      : { align: layoutDistributeToAlign(distribute), justify: layoutCrossToJustify(cross) }
  );
  const updateSelectedNodePackedAlignment = (cross: FeedNodeCrossAlign, distribute: FeedNodeDistribute) => {
    const node = selectedTargetNode();
    if (!node) return;
    const direction = resolveLayoutDirection(node.layout);
    updateSelectedNodeLayoutFields({
      crossAlign: cross,
      distribute,
      ...legacyScreenAlignment(direction, cross, distribute),
    });
  };
  const updateSelectedNodeDistributeMode = (mode: LayoutDistributeMode) => {
    const node = selectedTargetNode();
    if (!node) return;
    const direction = resolveLayoutDirection(node.layout);
    const cross = resolveLayoutCrossAlign(node.layout);
    const current = resolveLayoutDistribute(node.layout);
    const distribute: FeedNodeDistribute = mode === 'packed'
      ? (layoutPackedDistributes.some((item) => item === current) ? current : 'center')
      : mode;
    updateSelectedNodeLayoutFields({
      distribute,
      ...(mode === 'packed' ? legacyScreenAlignment(direction, cross, distribute) : {}),
    });
  };
  const selectedNodeLayout = () => selectedTargetNode()?.layout;
  const layoutXControlLabel = () => {
    const layout = selectedNodeLayout();
    if (!layout) return 'X';
    if (resolveLayoutSelfPosition(layout) === 'in-flow') return 'Old X';
    const constraint = resolveLayoutConstraintH(layout);
    if (constraint === 'center') return 'X Offset';
    if (constraint === 'right') return 'Right';
    return 'X';
  };
  const layoutYControlLabel = () => {
    const layout = selectedNodeLayout();
    if (!layout) return 'Y';
    if (resolveLayoutSelfPosition(layout) === 'in-flow') return 'Old Y';
    const constraint = resolveLayoutConstraintV(layout);
    if (constraint === 'center') return 'Y Offset';
    if (constraint === 'bottom') return 'Bottom';
    return 'Y';
  };
  const layoutXRange = () => {
    const layout = selectedNodeLayout();
    return layout && resolveLayoutConstraintH(layout) === 'center'
      ? { min: -80, max: 80 }
      : { min: -50, max: 150 };
  };
  const layoutYRange = () => {
    const layout = selectedNodeLayout();
    return layout && resolveLayoutConstraintV(layout) === 'center'
      ? { min: -80, max: 80 }
      : { min: -50, max: 150 };
  };
  const updateSelectedNodeTextStyle = <K extends keyof FeedTextSlotStyle>(key: K, value: FeedTextSlotStyle[K]) => {
    const node = selectedTargetNode();
    if (!node || !selectedNodeCanEditText()) return;
    updateSelectedNode({
      text: {
        ...resolveFeedNodeTextEditorStyle(editingCardType(), node),
        inherit: false,
        [key]: value,
      },
    });
  };
  const nodeTextControlLabel = (
    text: string,
    key: keyof FeedTextSlotStyle,
  ) => (
    <span class="ui-lab-control-label ui-lab-control-label--compact">
      <input
        type="checkbox"
        checked={Boolean(selectedNodeTextStyle()?.[key])}
        disabled={!selectedNodeTextCustom()}
        onChange={(event) => updateSelectedNodeTextStyle(key, event.currentTarget.checked as FeedTextSlotStyle[keyof FeedTextSlotStyle])}
      />
      {text}
    </span>
  );
  // Emboss UI model: checkbox off = no emboss (override, mode none);
  // checkbox on = dropdown inherit/dark/light/shadow (inherit = don't override base).
  const nodeEmbossOn = () => {
    const s = selectedNodeTextStyle();
    return !!s && !(s.overrideEmboss && s.textEmbossMode === 'none');
  };
  const nodeEmbossTunable = () => {
    const s = selectedNodeTextStyle();
    return !!selectedNodeTextCustom() && !!s && s.overrideEmboss && s.textEmbossMode !== 'none';
  };
  const nodeEmbossChoice = (): 'inherit' | 'dark' | 'light' | 'shadow' => {
    const s = selectedNodeTextStyle();
    if (!s || !s.overrideEmboss) return 'inherit';
    return s.textEmbossMode === 'none' ? 'inherit' : s.textEmbossMode as 'dark' | 'light' | 'shadow';
  };
  const setNodeEmbossOn = (on: boolean) => {
    if (on) {
      updateSelectedNodeTextStyle('overrideEmboss', false);
    } else {
      updateSelectedNodeTextStyle('overrideEmboss', true);
      updateSelectedNodeTextStyle('textEmbossMode', 'none');
    }
  };
  const setNodeEmbossChoice = (choice: 'inherit' | 'dark' | 'light' | 'shadow') => {
    if (choice === 'inherit') {
      updateSelectedNodeTextStyle('overrideEmboss', false);
    } else {
      updateSelectedNodeTextStyle('overrideEmboss', true);
      updateSelectedNodeTextStyle('textEmbossMode', choice);
    }
  };

  const handleImageFileChange = (event: Event & { currentTarget: HTMLInputElement }) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') props.onStoryImageOverrideChange(selectedStory().id, reader.result);
    });
    reader.readAsDataURL(file);
    event.currentTarget.value = '';
  };

  return (
    <>
      <Show when={isEditingCardRoot()}>
        <div class="ui-lab-control-group">
          <SectionLabel size="xs">Fake Server</SectionLabel>
          <div class="ui-lab-control-row">
            <span>Story</span>
            <select class="ui-lab-select" value={props.selectedStoryId} onChange={(event) => props.onSelectedStoryIdChange(event.currentTarget.value)}>
              <For each={props.stories}>
                {(story) => <option value={story.id}>{story.label}</option>}
              </For>
            </select>
          </div>
          <div class="ui-lab-control-row">
            <span>Story Uses</span>
            <span>{selectedStory().cardTypeId}</span>
          </div>
        </div>

        <div class="ui-lab-control-group">
          <SectionLabel size="xs">Card Type</SectionLabel>
          <div class="ui-lab-control-row">
            <span>Editing</span>
            <span>{props.editingCardTypeId}</span>
          </div>
          <div class="ui-lab-control-row">
            <span>Name</span>
            <input class="ui-lab-input main-material-text-input" value={editingCardType().name} onInput={(event) => updateEditingCardType({ name: event.currentTarget.value })} />
          </div>
        </div>

        <div class="ui-lab-control-group">
          <SectionLabel size="xs">Card Image</SectionLabel>
          <div class="ui-lab-control-row">
            <span>Enabled</span>
            <div class="ui-lab-toggles">
              <MiniButton active={editingCardType().backgroundImage.enabled} onClick={() => updateBackground('enabled', true)}>on</MiniButton>
              <MiniButton active={!editingCardType().backgroundImage.enabled} onClick={() => updateBackground('enabled', false)}>off</MiniButton>
            </div>
          </div>
          <div class="ui-lab-control-row">
            <span>Image URL</span>
            <input
              class="ui-lab-input main-material-text-input"
              value={selectedStoryImage()}
              onInput={(event) => props.onStoryImageOverrideChange(selectedStory().id, event.currentTarget.value)}
            />
          </div>
          <div class="ui-lab-control-row">
            <span>File</span>
            <input class="ui-lab-input main-material-file-input" type="file" accept="image/*" onChange={handleImageFileChange} />
          </div>
          <div class="ui-lab-control-row">
            <span>Override</span>
            <div class="ui-lab-toggles">
              <MiniButton active={Boolean(props.storyImageOverrides[selectedStory().id])} onClick={() => props.onStoryImageOverrideChange(selectedStory().id, null)}>clear</MiniButton>
            </div>
          </div>
          <div class="ui-lab-control-row">
            <span>Fit</span>
            <div class="ui-lab-toggles">
              <MiniButton active={editingCardType().backgroundImage.fit === 'cover'} onClick={() => updateBackground('fit', 'cover')}>cover</MiniButton>
              <MiniButton active={editingCardType().backgroundImage.fit === 'contain'} onClick={() => updateBackground('fit', 'contain')}>contain</MiniButton>
            </div>
          </div>
          <div class="ui-lab-control-row">
            <span>Scale</span>
            <Slider value={editingCardType().backgroundImage.scale} min={50} max={180} onInput={(value) => updateBackground('scale', value)} />
          </div>
          <div class="ui-lab-control-row">
            <span>X</span>
            <Slider value={editingCardType().backgroundImage.x} min={-100} max={100} onInput={(value) => updateBackground('x', value)} />
          </div>
          <div class="ui-lab-control-row">
            <span>Y</span>
            <Slider value={editingCardType().backgroundImage.y} min={-100} max={100} onInput={(value) => updateBackground('y', value)} />
          </div>
          <div class="ui-lab-control-row">
            <span>Fade</span>
            <select class="ui-lab-select" value={editingCardType().backgroundImage.fadeMode} onChange={(event) => updateBackground('fadeMode', event.currentTarget.value as FeedMediaFadeMode)}>
              <For each={feedMediaFadeModes}>
                {(mode) => <option value={mode}>{feedMediaFadeLabels[mode]}</option>}
              </For>
            </select>
          </div>
          <div class="ui-lab-control-row">
            <span>Fade Power</span>
            <Slider value={editingCardType().backgroundImage.fadeStrength} min={0} max={100} onInput={(value) => updateBackground('fadeStrength', value)} />
          </div>
          <div class="ui-lab-control-row">
            <span>Fade Size</span>
            <Slider value={editingCardType().backgroundImage.fadeSize} min={0} max={100} onInput={(value) => updateBackground('fadeSize', value)} />
          </div>
        </div>
      </Show>

      <div class="ui-lab-control-group">
        <SectionLabel size="xs">Structure</SectionLabel>
        <div class="ui-lab-control-row">
          <span>Status</span>
          <div class="ui-lab-toggles">
            <span>{structureStatus()}</span>
            <MiniButton disabled={!structureUndo()} onClick={undoStructureOperation}>undo</MiniButton>
          </div>
        </div>
        <Show when={selectedTargetNode()}>
          <div class="ui-lab-control-row">
            <span>Insert</span>
            <div class="ui-lab-toggles">
              <MiniButton disabled={selectedTargetNode()?.type !== 'container'} active={selectedInsertMode() === 'inside'} onClick={() => setInsertMode('inside')}>
                inside
              </MiniButton>
              <MiniButton active={selectedInsertMode() === 'after'} onClick={() => setInsertMode('after')}>
                after
              </MiniButton>
            </div>
          </div>
        </Show>
        <div class="ui-lab-control-row">
          <span>Add</span>
          <div class="ui-lab-toggles">
            <MiniButton onClick={addSurfacePanelNode}>panel</MiniButton>
            <MiniButton onClick={addTextBlockNode}>text</MiniButton>
            <MiniButton
              onClick={() => {
                const id = uniqueNodeId('two-column-group');
                insertNodeFromStructure(createTwoColumnGroupNode(id), id);
              }}
            >
              2-col
            </MiniButton>
            <MiniButton onClick={addRewardTermsTemplate}>terms</MiniButton>
          </div>
        </div>
        <Show when={selectedTargetNode()}>
          <div class="ui-lab-control-row">
            <span>Node Ops</span>
            <div class="ui-lab-toggles">
              <MiniButton onClick={() => moveSelectedNode(-1)}>up</MiniButton>
              <MiniButton onClick={() => moveSelectedNode(1)}>down</MiniButton>
              <MiniButton onClick={duplicateSelectedNode}>dup</MiniButton>
              <MiniButton onClick={wrapSelectedNodeInGroup}>wrap</MiniButton>
              <MiniButton disabled={selectedTargetNode()?.type !== 'container'} onClick={unwrapSelectedNode}>unwrap</MiniButton>
              <MiniButton onClick={deleteSelectedNode}>delete</MiniButton>
            </div>
          </div>
        </Show>
        <SectionLabel size="xs">Selected Node</SectionLabel>
        <Show when={selectedTargetNode()}>
          {(node) => (
            <>
              <div class="ui-lab-control-row">
                <span>Node</span>
                <span>{node().label}</span>
              </div>
              <Show when={selectedNodeCanBindContent()}>
                <SectionLabel size="xs">CMS</SectionLabel>
                <div class="ui-lab-control-row">
                  <span>State</span>
                  <span>{selectedNodeCmsState()}</span>
                </div>
                <div class="ui-lab-control-row">
                  <span>Binding</span>
                  <select
                    class="ui-lab-select"
                    value={node().binding || ''}
                    onChange={(event) => updateSelectedNodeBinding(event.currentTarget.value as FeedTextSlotId | '')}
                  >
                    <option value="">none</option>
                    <For each={feedTextSlotIds}>
                      {(slotId) => <option value={slotId}>{feedTextSlotLabels[slotId]}</option>}
                    </For>
                  </select>
                </div>
                <div class="ui-lab-control-row">
                  <span>Type</span>
                  <span>{selectedNodeFieldKind()}</span>
                </div>
                <Show when={node().binding}>
                  {(binding) => (
                    <div class="ui-lab-control-row">
                      <span>Field</span>
                      <span>{binding()}</span>
                    </div>
                  )}
                </Show>
                <Show when={node().binding}>
                  <div class="ui-lab-control-row ui-lab-control-row--stacked">
                    <span>Preview</span>
                    <code>{selectedNodeStoryTextPreview()}</code>
                  </div>
                </Show>
                <div class="ui-lab-control-row">
                  <span>Output</span>
                  <MiniButton disabled={!props.selectedStoryContentJson} onClick={props.onCopySelectedStoryContentJson}>copy ui-node-content</MiniButton>
                </div>
              </Show>
              <Show when={node().binding}>
                {(binding) => (
                  <div class="ui-lab-control-row ui-lab-control-row--stacked">
                    <span>Markup</span>
                    <textarea
                      class="ui-lab-input main-material-text-input main-material-markup-input"
                      value={selectedNodeStoryText()}
                      onInput={(event) => props.onStoryTextChange(selectedStory().id, binding(), event.currentTarget.value)}
                    />
                  </div>
                )}
              </Show>
              <Show when={selectedNodeCanEditText()}>
                <div class="ui-lab-control-row">
                  <span>Text</span>
                  <div class="ui-lab-toggles">
                    <MiniButton active={selectedNodeTextMode() === 'inherit'} onClick={() => updateSelectedNodeTextMode('inherit')}>inherit</MiniButton>
                    <MiniButton active={selectedNodeTextMode() === 'custom'} onClick={() => updateSelectedNodeTextMode('custom')}>custom</MiniButton>
                  </div>
                </div>
                <div class="ui-lab-control-row">
                  <span>Markup</span>
                  <div class="ui-lab-toggles">
                    <For each={['auto', 'on', 'off'] as const}>
                      {(mode) => (
                        <MiniButton active={(node().markup ?? legacyMarkupMode(node().textRender)) === mode} onClick={() => updateSelectedNode({ markup: mode })}>
                          {mode}
                        </MiniButton>
                      )}
                    </For>
                  </div>
                </div>
                <div class="ui-lab-control-row">
                  <span>Render</span>
                  <div class="ui-lab-toggles">
                    <For each={['auto', 'fit', 'flow'] as const}>
                      {(mode) => (
                        <MiniButton
                          disabled={mode === 'fit' && selectedNodeRenderFitDisabled()}
                          active={(node().sizing ?? legacySizingMode(node().textRender)) === mode}
                          onClick={() => updateSelectedNode({ sizing: mode })}
                        >
                          {mode}
                        </MiniButton>
                      )}
                    </For>
                  </div>
                </div>
                <Show when={resolveFeedNodeFit(node()) && !selectedNodeRenderFitDisabled()}>
                  <div class="ui-lab-control-row">
                    <span>Fit</span>
                    <div class="ui-lab-toggles">
                      <For each={['single-line', 'fixed-lines', 'paragraph'] as const}>
                        {(mode) => (
                          <MiniButton active={(node().fitMode ?? 'single-line') === mode} onClick={() => updateSelectedNode({ fitMode: mode })}>
                            {mode}
                          </MiniButton>
                        )}
                      </For>
                    </div>
                  </div>
                  <div class="ui-lab-control-row">
                    <span>Lines</span>
                    <Slider value={node().maxLines ?? 1} min={1} max={8} onInput={(value) => updateSelectedNode({ maxLines: value })} />
                  </div>
                </Show>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overrideColor ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Color', 'overrideColor')}
                  <select
                    class="ui-lab-select"
                    value={selectedNodeTextStyle()?.contentTone ?? 'white'}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overrideColor}
                    onChange={(event) => updateSelectedNodeTextStyle('contentTone', event.currentTarget.value as MaterialTone)}
                  >
                    <For each={materialRecipeContentTones}>
                      {(tone) => <option value={tone}>{tone}</option>}
                    </For>
                  </select>
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overrideOpacity ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Opacity', 'overrideOpacity')}
                  <Slider
                    value={selectedNodeTextStyle()?.textOpacity ?? 90}
                    min={0}
                    max={100}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overrideOpacity}
                    onInput={(value) => updateSelectedNodeTextStyle('textOpacity', value)}
                  />
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overrideFont ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Font', 'overrideFont')}
                  <select
                    class="ui-lab-select"
                    value={selectedNodeTextStyle()?.textFontFamily ?? feedDefaultTextFontCondensed}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overrideFont}
                    onChange={(event) => updateSelectedNodeTextStyle('textFontFamily', event.currentTarget.value)}
                  >
                    <For each={materialRecipeTextFonts}>
                      {(font) => <option value={font.value}>{font.label}</option>}
                    </For>
                  </select>
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overrideSize ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Size', 'overrideSize')}
                  <Slider
                    value={selectedNodeTextStyle()?.textSizeRem ?? 1}
                    min={0.4}
                    max={2.4}
                    step={0.05}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overrideSize}
                    onInput={(value) => updateSelectedNodeTextStyle('textSizeRem', value)}
                  />
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overrideWeight ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Weight', 'overrideWeight')}
                  <Slider
                    value={selectedNodeTextStyle()?.fontWeight ?? 600}
                    min={100}
                    max={900}
                    step={100}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overrideWeight}
                    onInput={(value) => updateSelectedNodeTextStyle('fontWeight', value as FontWeightToken)}
                  />
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overrideStyle ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Style', 'overrideStyle')}
                  <select
                    class="ui-lab-select"
                    value={selectedNodeTextStyle()?.fontStyle ?? 'normal'}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overrideStyle}
                    onChange={(event) => updateSelectedNodeTextStyle('fontStyle', event.currentTarget.value as FontStyleToken)}
                  >
                    <For each={materialRecipeFontStyles}>
                      {(style) => <option value={style}>{style}</option>}
                    </For>
                  </select>
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overrideCase ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Case', 'overrideCase')}
                  <select
                    class="ui-lab-select"
                    value={selectedNodeTextStyle()?.textTransform ?? 'inherit'}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overrideCase}
                    onChange={(event) => updateSelectedNodeTextStyle('textTransform', event.currentTarget.value as FeedTextTransformToken)}
                  >
                    <For each={['inherit', ...materialRecipeTextTransforms] as FeedTextTransformToken[]}>
                      {(transform) => <option value={transform}>{transform}</option>}
                    </For>
                  </select>
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overrideLineHeight ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Line', 'overrideLineHeight')}
                  <Slider
                    value={selectedNodeTextStyle()?.lineHeight ?? 1}
                    min={0.7}
                    max={1.8}
                    step={0.02}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overrideLineHeight}
                    onInput={(value) => updateSelectedNodeTextStyle('lineHeight', value)}
                  />
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overrideParagraphGap ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Para Gap', 'overrideParagraphGap')}
                  <Slider
                    value={selectedNodeTextStyle()?.paragraphGap ?? 0}
                    min={-24}
                    max={48}
                    step={1}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overrideParagraphGap}
                    onInput={(value) => updateSelectedNodeTextStyle('paragraphGap', value)}
                  />
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overrideLetterSpacing ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Track', 'overrideLetterSpacing')}
                  <Slider
                    value={selectedNodeTextStyle()?.letterSpacing ?? 0}
                    min={-0.08}
                    max={0.24}
                    step={0.01}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overrideLetterSpacing}
                    onInput={(value) => updateSelectedNodeTextStyle('letterSpacing', value)}
                  />
                </div>
                <div class={`ui-lab-control-row ${nodeEmbossOn() ? '' : 'ui-lab-control-row--disabled'}`}>
                  <span class="ui-lab-control-label ui-lab-control-label--compact">
                    <input
                      type="checkbox"
                      checked={nodeEmbossOn()}
                      disabled={!selectedNodeTextCustom()}
                      onChange={(event) => setNodeEmbossOn(event.currentTarget.checked)}
                    />
                    Emboss
                  </span>
                  <select
                    class="ui-lab-select"
                    value={nodeEmbossChoice()}
                    disabled={!selectedNodeTextCustom() || !nodeEmbossOn()}
                    onChange={(event) => setNodeEmbossChoice(event.currentTarget.value as 'inherit' | 'dark' | 'light' | 'shadow')}
                  >
                    <option value="inherit">inherit</option>
                    <option value="dark">dark</option>
                    <option value="light">light</option>
                    <option value="shadow">shadow</option>
                  </select>
                </div>
                <div class={`ui-lab-control-row ${nodeEmbossTunable() ? '' : 'ui-lab-control-row--disabled'}`}>
                  <span>Power</span>
                  <Slider
                    value={selectedNodeTextStyle()?.textEmbossStrength ?? 100}
                    min={0}
                    max={100}
                    disabled={!nodeEmbossTunable()}
                    onInput={(value) => updateSelectedNodeTextStyle('textEmbossStrength', value)}
                  />
                </div>
                <div class={`ui-lab-control-row ${nodeEmbossTunable() ? '' : 'ui-lab-control-row--disabled'}`}>
                  <span>Offset</span>
                  <Slider
                    value={selectedNodeTextStyle()?.textEmbossOffset ?? 50}
                    min={0}
                    max={100}
                    disabled={!nodeEmbossTunable()}
                    onInput={(value) => updateSelectedNodeTextStyle('textEmbossOffset', value)}
                  />
                </div>
                <div class={`ui-lab-control-row ${nodeEmbossTunable() ? '' : 'ui-lab-control-row--disabled'}`}>
                  <span>Blur</span>
                  <Slider
                    value={selectedNodeTextStyle()?.textEmbossBlur ?? 50}
                    min={0}
                    max={100}
                    disabled={!nodeEmbossTunable()}
                    onInput={(value) => updateSelectedNodeTextStyle('textEmbossBlur', value)}
                  />
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overrideAlign ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Align', 'overrideAlign')}
                  <div class="ui-lab-toggles">
                    <For each={materialRecipeTextAligns}>
                      {(align) => (
                        <MiniButton disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overrideAlign} active={selectedNodeTextStyle()?.textAlign === align} onClick={() => updateSelectedNodeTextStyle('textAlign', align)}>
                          {align}
                        </MiniButton>
                      )}
                    </For>
                  </div>
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overridePosition ? '' : 'ui-lab-control-row--disabled'}`}>
                  {nodeTextControlLabel('Text X', 'overridePosition')}
                  <Slider
                    value={selectedNodeTextStyle()?.textX ?? 0}
                    min={-80}
                    max={80}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overridePosition}
                    onInput={(value) => updateSelectedNodeTextStyle('textX', value)}
                  />
                </div>
                <div class={`ui-lab-control-row ${selectedNodeTextCustom() && selectedNodeTextStyle()?.overridePosition ? '' : 'ui-lab-control-row--disabled'}`}>
                  <span>Text Y</span>
                  <Slider
                    value={selectedNodeTextStyle()?.textY ?? 0}
                    min={-80}
                    max={80}
                    disabled={!selectedNodeTextCustom() || !selectedNodeTextStyle()?.overridePosition}
                    onInput={(value) => updateSelectedNodeTextStyle('textY', value)}
                  />
                </div>
              </Show>
              <SectionLabel size="xs">Layout</SectionLabel>
              <div class="ui-lab-control-row">
                <span>Mode</span>
                <div class="ui-lab-toggles">
                  <MiniButton active={node().layout.mode === 'absolute'} onClick={() => updateSelectedNodeLayout('mode', 'absolute')}>
                    absolute
                  </MiniButton>
                  <MiniButton active={node().layout.mode === 'flow'} onClick={() => updateSelectedNodeLayout('mode', 'flow')}>
                    flow
                  </MiniButton>
                </div>
              </div>
              <div class="ui-lab-control-row">
                <span>Direction</span>
                <div class="ui-lab-toggles">
                  <For each={['column', 'row'] as const}>
                    {(d) => (
                      <MiniButton active={(node().layout.direction ?? 'column') === d} onClick={() => updateSelectedNodeLayout('direction', d)}>
                        {d}
                      </MiniButton>
                    )}
                  </For>
                  <MiniButton active={!!node().layout.wrap} onClick={() => updateSelectedNodeLayout('wrap', !node().layout.wrap)}>
                    wrap
                  </MiniButton>
                </div>
              </div>
              <div class="ui-lab-control-row">
                <span>Self</span>
                <div class="ui-lab-toggles">
                  <For each={['in-flow', 'absolute'] as const}>
                    {(position) => (
                      <MiniButton active={resolveLayoutSelfPosition(node().layout) === position} onClick={() => updateSelectedNodeLayout('selfPosition', position)}>
                        {position}
                      </MiniButton>
                    )}
                  </For>
                </div>
              </div>
              <Show when={resolveLayoutSelfPosition(node().layout) === 'absolute'}>
                <div class="ui-lab-control-row">
                  <span>Pin H</span>
                  <select
                    class="ui-lab-select"
                    value={resolveLayoutConstraintH(node().layout)}
                    onChange={(event) => updateSelectedNodeConstraintH(event.currentTarget.value as FeedNodeConstraintH)}
                  >
                    <For each={['left', 'right', 'left-right', 'center'] as const}>
                      {(constraint) => <option value={constraint}>{constraint}</option>}
                    </For>
                  </select>
                </div>
                <div class="ui-lab-control-row">
                  <span>Pin V</span>
                  <select
                    class="ui-lab-select"
                    value={resolveLayoutConstraintV(node().layout)}
                    onChange={(event) => updateSelectedNodeConstraintV(event.currentTarget.value as FeedNodeConstraintV)}
                  >
                    <For each={['top', 'bottom', 'top-bottom', 'center'] as const}>
                      {(constraint) => <option value={constraint}>{constraint}</option>}
                    </For>
                  </select>
                </div>
              </Show>
              <div class="ui-lab-control-row">
                <span>Pin End</span>
                <div class="ui-lab-toggles">
                  <MiniButton active={resolveLayoutPushToEnd(node().layout)} onClick={() => updateSelectedNodeLayout('pushToEnd', !resolveLayoutPushToEnd(node().layout))}>
                    end
                  </MiniButton>
                </div>
              </div>
              <Show when={node().layout.mode === 'flow'}>
                <div class="ui-lab-control-row">
                  <span>Slot</span>
                  <div class="ui-lab-toggles">
                    <For each={['auto', 'body', 'footer', 'overlay'] as const}>
                      {(slot) => (
                        <MiniButton active={node().layout.slot === slot} onClick={() => updateSelectedNodeLayout('slot', slot)}>
                          {slot}
                        </MiniButton>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
              <div class="ui-lab-control-row">
                <span>{layoutXControlLabel()}</span>
                <Slider value={node().layout.x} min={layoutXRange().min} max={layoutXRange().max} disabled={resolveLayoutSelfPosition(node().layout) === 'in-flow'} onInput={(value) => updateSelectedNodeLayout('x', value)} />
              </div>
              <div class="ui-lab-control-row">
                <span>{layoutYControlLabel()}</span>
                <Slider value={node().layout.y} min={layoutYRange().min} max={layoutYRange().max} disabled={resolveLayoutSelfPosition(node().layout) === 'in-flow'} onInput={(value) => updateSelectedNodeLayout('y', value)} />
              </div>
              <div class="ui-lab-control-row">
                <span>W</span>
                <div class="ui-lab-toggles">
                  <For each={['fixed', 'hug', 'fill'] as const}>
                    {(m) => (
                      <MiniButton active={(node().layout.wMode ?? 'fixed') === m} onClick={() => updateSelectedNodeLayout('wMode', m)}>
                        {m}
                      </MiniButton>
                    )}
                  </For>
                </div>
              </div>
              <div class="ui-lab-control-row">
                <span>W size</span>
                <Slider value={node().layout.width} min={4} max={140} disabled={(node().layout.wMode ?? 'fixed') !== 'fixed'} onInput={(value) => updateSelectedNodeLayout('width', value)} />
              </div>
              <div class="ui-lab-control-row">
                <span>H</span>
                <div class="ui-lab-toggles">
                  <For each={['fixed', 'hug', 'fill'] as const}>
                    {(m) => (
                      <MiniButton active={(node().layout.hMode ?? 'fixed') === m} onClick={() => updateSelectedNodeLayout('hMode', m)}>
                        {m}
                      </MiniButton>
                    )}
                  </For>
                </div>
              </div>
              <div class="ui-lab-control-row">
                <span>H size</span>
                <Slider value={node().layout.height} min={4} max={140} disabled={(node().layout.hMode ?? 'fixed') !== 'fixed'} onInput={(value) => updateSelectedNodeLayout('height', value)} />
              </div>
              <Show when={node().layout.mode === 'flow'}>
                <div class="ui-lab-control-row">
                  <span>Nudge X</span>
                  <Slider value={node().layout.nudgeX} min={-80} max={80} onInput={(value) => updateSelectedNodeLayout('nudgeX', value)} />
                </div>
                <div class="ui-lab-control-row">
                  <span>Nudge Y</span>
                  <Slider value={node().layout.nudgeY} min={-80} max={80} onInput={(value) => updateSelectedNodeLayout('nudgeY', value)} />
                </div>
              </Show>
              <div class="ui-lab-control-row">
                <span>Pad</span>
                <Slider value={node().layout.padding} min={0} max={40} onInput={(value) => updateSelectedNodeLayout('padding', value)} />
              </div>
              <div class="ui-lab-control-row">
                <span>{selectedNodeCanEditText() ? 'Line Gap' : 'Gap'}</span>
                <Slider value={node().layout.gap} min={0} max={40} onInput={(value) => updateSelectedNodeLayout('gap', value)} />
              </div>
              <div class="ui-lab-control-row">
                <span>{resolveLayoutDirection(node().layout) === 'column' ? 'Align X' : 'Align Y'}</span>
                <div
                  class="ui-lab-toggles"
                  style={{ display: 'grid', 'grid-template-columns': 'repeat(3, minmax(0, 1fr))', gap: '4px' }}
                >
                  <For each={layoutCrossPositions}>
                    {(visualRow) => (
                      <For each={layoutCrossPositions}>
                        {(visualColumn) => {
                          const cell = () => layoutGridCell(resolveLayoutDirection(node().layout), visualRow, visualColumn);
                          const active = () => {
                            const current = cell();
                            return layoutDistributeMode(resolveLayoutDistribute(node().layout)) === 'packed'
                              && resolveLayoutCrossAlign(node().layout) === current.cross
                              && resolveLayoutDistribute(node().layout) === current.distribute;
                          };
                          return (
                            <MiniButton active={active()} onClick={() => updateSelectedNodePackedAlignment(cell().cross, cell().distribute)}>
                              {layoutGridCellLabel(visualRow, visualColumn)}
                            </MiniButton>
                          );
                        }}
                      </For>
                    )}
                  </For>
                </div>
              </div>
              <div class="ui-lab-control-row">
                <span>{resolveLayoutDirection(node().layout) === 'column' ? 'Spread Y' : 'Spread X'}</span>
                <div class="ui-lab-toggles">
                  <For each={layoutDistributeModes}>
                    {(mode) => (
                      <MiniButton
                        active={layoutDistributeMode(resolveLayoutDistribute(node().layout)) === mode}
                        onClick={() => updateSelectedNodeDistributeMode(mode)}
                      >
                        {mode}
                      </MiniButton>
                    )}
                  </For>
                </div>
              </div>
            </>
          )}
        </Show>
      </div>

      <Show when={isEditingCardRoot()}>
        <div class="ui-lab-control-group">
          <SectionLabel size="xs">Feed Layout</SectionLabel>
          <div class="ui-lab-control-row">
            <span>Content Y</span>
            <Slider value={props.feed.contentY} min={-32} max={48} onInput={(value) => update('contentY', value)} />
          </div>
          <div class="ui-lab-control-row">
            <span>Copy Lift</span>
            <Slider value={props.feed.cardGap} min={8} max={32} onInput={(value) => update('cardGap', value)} />
          </div>
          <div class="ui-lab-control-row">
            <span>Dot Gap</span>
            <Slider value={props.feed.newsGap} min={6} max={28} onInput={(value) => update('newsGap', value)} />
          </div>
        </div>
      </Show>
    </>
  );
};

export const FeedTextGlobalsEditor = (props: {
  cardType: FeedCardTypeRecipe;
  onSlotChange: <K extends keyof FeedTextSlotStyle>(slot: FeedTextSlotId, key: K, value: FeedTextSlotStyle[K]) => void;
}) => {
  const slot = (slotId: FeedTextSlotId) => props.cardType.slots[slotId];
  const typeRows: Array<{ label: string; slot: FeedTextSlotId; paragraph?: boolean; line?: boolean; track?: boolean; divider?: boolean }> = [
    { label: 'Body', slot: 'contractBriefing', paragraph: true, line: true, track: true },
    { label: 'H1', slot: 'contractEyebrow', line: true },
    { label: 'H2', slot: 'contractTitle', line: true },
    { label: 'H3', slot: 'contractRewardValue', line: true },
    { label: 'H4', slot: 'contractH4', line: true },
    { label: 'Acc 1', slot: 'contractAcc1' },
    { label: 'Acc 2', slot: 'contractAcc2' },
    { label: 'Acc 3', slot: 'contractAcc3' },
    { label: 'Acc 4', slot: 'contractAcc4' },
    { label: 'Rule', slot: 'contractRule' },
    { label: 'Divider', slot: 'contractDivider', paragraph: true, line: true, divider: true },
    { label: 'Button', slot: 'contractCtaLabel', track: true },
  ];
  const overridableSlots = new Set<FeedTextSlotId>([
    'contractBriefing',
    'contractEyebrow',
    'contractTitle',
    'contractRewardValue',
    'contractH4',
    'contractAcc1',
    'contractAcc2',
    'contractAcc3',
    'contractAcc4',
    'contractCtaLabel',
  ]);
  const canToggle = (slotId: FeedTextSlotId) => overridableSlots.has(slotId);
  const overrideFor = (slotId: FeedTextSlotId, key: keyof FeedTextSlotStyle) => !canToggle(slotId) || Boolean(slot(slotId)[key]);
  const controlLabel = (
    slotId: FeedTextSlotId,
    text: string,
    key?: keyof FeedTextSlotStyle,
  ) => (
    <span class="ui-lab-control-label ui-lab-control-label--compact">
      <Show when={key && canToggle(slotId)}>
        <input
          type="checkbox"
          checked={Boolean(slot(slotId)[key as keyof FeedTextSlotStyle])}
          onChange={(event) => props.onSlotChange(slotId, key as keyof FeedTextSlotStyle, event.currentTarget.checked as FeedTextSlotStyle[keyof FeedTextSlotStyle])}
        />
      </Show>
      {text}
    </span>
  );

  return (
    <div class="ui-lab-control-grid">
      <For each={typeRows}>
        {(row) => {
          const colorEnabled = () => overrideFor(row.slot, 'overrideColor');
          const opacityEnabled = () => overrideFor(row.slot, 'overrideOpacity');
          const fontEnabled = () => overrideFor(row.slot, 'overrideFont');
          const sizeEnabled = () => overrideFor(row.slot, 'overrideSize');
          const weightEnabled = () => overrideFor(row.slot, 'overrideWeight');
          const caseEnabled = () => overrideFor(row.slot, 'overrideCase');
          const embossOn = () => {
            const sv = slot(row.slot);
            return !(sv.overrideEmboss && sv.textEmbossMode === 'none');
          };
          const embossTunable = () => {
            const sv = slot(row.slot);
            return sv.overrideEmboss && sv.textEmbossMode !== 'none';
          };
          const embossChoice = (): 'inherit' | 'dark' | 'light' | 'shadow' => {
            const sv = slot(row.slot);
            if (!sv.overrideEmboss) return 'inherit';
            return sv.textEmbossMode === 'none' ? 'inherit' : sv.textEmbossMode as 'dark' | 'light' | 'shadow';
          };
          const setEmbossOn = (on: boolean) => {
            if (on) {
              props.onSlotChange(row.slot, 'overrideEmboss', false);
            } else {
              props.onSlotChange(row.slot, 'overrideEmboss', true);
              props.onSlotChange(row.slot, 'textEmbossMode', 'none');
            }
          };
          const setEmbossChoice = (choice: 'inherit' | 'dark' | 'light' | 'shadow') => {
            if (choice === 'inherit') {
              props.onSlotChange(row.slot, 'overrideEmboss', false);
            } else {
              props.onSlotChange(row.slot, 'overrideEmboss', true);
              props.onSlotChange(row.slot, 'textEmbossMode', choice);
            }
          };
          const lineEnabled = () => overrideFor(row.slot, 'overrideLineHeight');
          const trackEnabled = () => overrideFor(row.slot, 'overrideLetterSpacing');
          return (
          <div class="ui-lab-control-group">
            <SectionLabel size="xs">{row.label}</SectionLabel>
            <div class={`ui-lab-control-row ${colorEnabled() ? '' : 'ui-lab-control-row--disabled'}`}>
              {controlLabel(row.slot, 'Color', 'overrideColor')}
              <select
                class="ui-lab-select"
                value={slot(row.slot).contentTone}
                disabled={!colorEnabled()}
                onChange={(event) => props.onSlotChange(row.slot, 'contentTone', event.currentTarget.value as MaterialTone)}
              >
                <For each={materialRecipeContentTones}>
                  {(tone) => <option value={tone}>{tone}</option>}
                </For>
              </select>
            </div>
            <div class={`ui-lab-control-row ${opacityEnabled() ? '' : 'ui-lab-control-row--disabled'}`}>
              {controlLabel(row.slot, 'Opacity', 'overrideOpacity')}
              <Slider value={slot(row.slot).textOpacity} min={0} max={100} disabled={!opacityEnabled()} onInput={(value) => props.onSlotChange(row.slot, 'textOpacity', value)} />
            </div>
            <Show when={!row.divider}>
              <div class={`ui-lab-control-row ${fontEnabled() ? '' : 'ui-lab-control-row--disabled'}`}>
                {controlLabel(row.slot, 'Font', 'overrideFont')}
                <select
                  class="ui-lab-select"
                  value={slot(row.slot).textFontFamily}
                  disabled={!fontEnabled()}
                  onChange={(event) => props.onSlotChange(row.slot, 'textFontFamily', event.currentTarget.value)}
                >
                  <For each={materialRecipeTextFonts}>
                    {(font) => <option value={font.value}>{font.label}</option>}
                  </For>
                </select>
              </div>
            </Show>
            <div class={`ui-lab-control-row ${sizeEnabled() ? '' : 'ui-lab-control-row--disabled'}`}>
              {controlLabel(row.slot, row.divider ? 'Thick' : 'Size', 'overrideSize')}
              <Slider value={slot(row.slot).textSizeRem} min={row.divider ? 0.5 : 0.4} max={row.divider ? 4 : 2.4} step={row.divider ? 0.1 : 0.05} disabled={!sizeEnabled()} onInput={(value) => props.onSlotChange(row.slot, 'textSizeRem', value)} />
            </div>
            <Show when={!row.divider}>
              <div class={`ui-lab-control-row ${weightEnabled() ? '' : 'ui-lab-control-row--disabled'}`}>
                {controlLabel(row.slot, 'Weight', 'overrideWeight')}
                <Slider
                  value={slot(row.slot).fontWeight}
                  min={100}
                  max={900}
                  step={100}
                  disabled={!weightEnabled()}
                  onInput={(value) => props.onSlotChange(row.slot, 'fontWeight', value as FontWeightToken)}
                />
              </div>
            </Show>
            <Show when={row.line}>
              <div class={`ui-lab-control-row ${lineEnabled() ? '' : 'ui-lab-control-row--disabled'}`}>
                {controlLabel(row.slot, row.divider ? 'Gap Above' : 'Line', 'overrideLineHeight')}
                <Slider value={slot(row.slot).lineHeight} min={row.divider ? 0 : 0.7} max={row.divider ? 3 : 1.8} step={row.divider ? 0.05 : 0.02} disabled={!lineEnabled()} onInput={(value) => props.onSlotChange(row.slot, 'lineHeight', value)} />
              </div>
            </Show>
            <Show when={row.paragraph}>
              <div class="ui-lab-control-row">
                <span>{row.divider ? 'Gap Below' : 'Para Gap'}</span>
                <Slider value={slot(row.slot).paragraphGap} min={row.divider ? 0 : -24} max={row.divider ? 3 : 48} step={row.divider ? 0.05 : 1} onInput={(value) => props.onSlotChange(row.slot, 'paragraphGap', value)} />
              </div>
            </Show>
            <Show when={(row.track || row.line) && !row.divider}>
              <div class={`ui-lab-control-row ${trackEnabled() ? '' : 'ui-lab-control-row--disabled'}`}>
                {controlLabel(row.slot, 'Track', 'overrideLetterSpacing')}
                <Slider value={slot(row.slot).letterSpacing} min={-0.08} max={0.24} step={0.01} disabled={!trackEnabled()} onInput={(value) => props.onSlotChange(row.slot, 'letterSpacing', value)} />
              </div>
            </Show>
            <Show when={!row.divider}>
              <div class={`ui-lab-control-row ${caseEnabled() ? '' : 'ui-lab-control-row--disabled'}`}>
                {controlLabel(row.slot, 'Case', 'overrideCase')}
                <select
                  class="ui-lab-select"
                  value={slot(row.slot).textTransform}
                  disabled={!caseEnabled()}
                  onChange={(event) => props.onSlotChange(row.slot, 'textTransform', event.currentTarget.value as FeedTextTransformToken)}
                >
                  <For each={['inherit', ...materialRecipeTextTransforms] as FeedTextTransformToken[]}>
                    {(transform) => <option value={transform}>{transform}</option>}
                  </For>
                </select>
              </div>
            </Show>
            <Show when={!row.divider}>
              <div class={`ui-lab-control-row ${embossOn() ? '' : 'ui-lab-control-row--disabled'}`}>
                <span class="ui-lab-control-label ui-lab-control-label--compact">
                  <input type="checkbox" checked={embossOn()} onChange={(event) => setEmbossOn(event.currentTarget.checked)} />
                  Emboss
                </span>
                <select
                  class="ui-lab-select"
                  value={embossChoice()}
                  disabled={!embossOn()}
                  onChange={(event) => setEmbossChoice(event.currentTarget.value as 'inherit' | 'dark' | 'light' | 'shadow')}
                >
                  <option value="inherit">inherit</option>
                  <option value="dark">dark</option>
                  <option value="light">light</option>
                  <option value="shadow">shadow</option>
                </select>
              </div>
              <div class={`ui-lab-control-row ${embossTunable() ? '' : 'ui-lab-control-row--disabled'}`}>
                <span>Power</span>
                <Slider value={slot(row.slot).textEmbossStrength} min={0} max={100} disabled={!embossTunable()} onInput={(value) => props.onSlotChange(row.slot, 'textEmbossStrength', value)} />
              </div>
              <div class={`ui-lab-control-row ${embossTunable() ? '' : 'ui-lab-control-row--disabled'}`}>
                <span>Offset</span>
                <Slider value={slot(row.slot).textEmbossOffset} min={0} max={100} disabled={!embossTunable()} onInput={(value) => props.onSlotChange(row.slot, 'textEmbossOffset', value)} />
              </div>
              <div class={`ui-lab-control-row ${embossTunable() ? '' : 'ui-lab-control-row--disabled'}`}>
                <span>Blur</span>
                <Slider value={slot(row.slot).textEmbossBlur} min={0} max={100} disabled={!embossTunable()} onInput={(value) => props.onSlotChange(row.slot, 'textEmbossBlur', value)} />
              </div>
            </Show>
          </div>
          );
        }}
      </For>
    </div>
  );
};
