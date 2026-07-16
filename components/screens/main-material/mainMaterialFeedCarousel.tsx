import { createEffect, createSignal, For, JSX, Show } from 'solid-js';
import {
  fontWeightTokenValue,
  MaterialSurfaceHost,
  type MaterialRecipe,
  type MaterialRecipeState,
  type SurfaceOptions,
} from '../../ui/material-lab';
import {
  MaterialNodeRenderer,
  MaterialNodeDomRegistrationProvider,
  type MaterialNodeRecipe,
  type MaterialNodeRenderContext,
  type MaterialNodeRole,
} from '../../ui/material-node';
import { feedCardNodeToMaterialNode } from './mainMaterialFeedToNode';
import { useMainMaterialDomRegistration } from './mainMaterialFeedFrame';
import type { FeedNodeLayout } from './feedNodeLayoutCss';
import type { PreviewTargetRole } from './mainMaterialInteractionModel';
import { feedCardMaterialTargetId, feedMaterialTargetIdForNode, type FeedMaterialTargetId as MainFeedMaterialTargetId } from './materialTargetIds';
import { FeedNodeFrame, type CssEmissionProbe } from './mainMaterialFeedFrame';
import { FeedRichText } from './mainMaterialFeedRichText';
import { feedLayoutCarouselCssVars } from './mainMaterialFeedLayoutControls';
import {
  feedBackgroundImageCss,
  feedMediaFadeCss,
  feedNodeContentValue,
  feedNodeFitMode,
  feedNodeMaxLines,
  feedNodeSurfaceRecipe,
  feedRichTextTransform,
  feedStoryValue,
  feedTextCss,
  resolveFeedNodeRenderMode,
  resolveFeedNodeTextStyle,
} from './mainMaterialFeedText';
import { type FeedRecipe } from './mainMaterialFeedEditors';
import {
  createFeedNode,
  createFeedNodeLayout,
  feedDefaultTextFontDin,
  type FeedCardNode,
  type FeedCardTypes,
  type FeedCardTypeId,
  type FeedCardTypeRecipe,
  type FeedStory,
} from './mainMaterialFeedModel';
import type { FingerprintHoldActionRuntimePlanV1 } from '../../ui/semantic-runtime/fingerprint-hold/fingerprintHoldRuntimePlan';
import type { UiActionEventHandler } from '../../ui/semantic-runtime/actions/UiActionEvent';

type FeedMaterialTargetId = MainFeedMaterialTargetId<FeedCardTypeId>;
export type FeedSurfacePropsForRecipe = (recipe: MaterialRecipe, state: MaterialRecipeState) => SurfaceOptions;

const createFeedSlideLayerLayout = (): FeedNodeLayout => createFeedNodeLayout({
  mode: 'absolute',
  selfPosition: 'absolute',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  padding: 0,
  gap: 0,
  align: 'left',
  justify: 'start',
  direction: 'column',
  distribute: 'start',
  crossAlign: 'stretch',
  wMode: 'fixed',
  hMode: 'fixed',
  constraintH: 'left-right',
  constraintV: 'top-bottom',
});

const createFeedSlideFrameNode = (cardTypeId: FeedCardTypeId): FeedCardNode => createFeedNode({
  id: `feed-slide-${cardTypeId}`,
  label: 'Feed Slide',
  type: 'container',
  layout: createFeedSlideLayerLayout(),
  children: [
    createFeedNode({
      id: `feed-slide-${cardTypeId}-media`,
      label: 'Feed Media',
      type: 'container',
      layout: createFeedSlideLayerLayout(),
    }),
    createFeedNode({
      id: `feed-slide-${cardTypeId}-content`,
      label: 'Feed Content',
      type: 'container',
      layout: createFeedSlideLayerLayout(),
    }),
  ],
});

const createFeedDotsNode = (gap: number): FeedCardNode => createFeedNode({
  id: 'feed-dots',
  label: 'Feed Slides',
  type: 'container',
  layout: createFeedNodeLayout({
    mode: 'absolute',
    selfPosition: 'absolute',
    x: 0,
    y: 3.5,
    width: 100,
    height: 4,
    padding: 0,
    gap,
    align: 'center',
    justify: 'center',
    direction: 'row',
    distribute: 'center',
    crossAlign: 'center',
    wMode: 'fixed',
    hMode: 'fixed',
    constraintH: 'left-right',
    constraintV: 'bottom',
  }),
});

const createFeedTrackNode = (): FeedCardNode => createFeedNode({
  id: 'feed-track',
  label: 'Feed Track',
  type: 'container',
  layout: createFeedNodeLayout({
    mode: 'absolute',
    selfPosition: 'absolute',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    padding: 0,
    gap: 0,
    align: 'left',
    justify: 'start',
    direction: 'row',
    distribute: 'start',
    crossAlign: 'stretch',
    wMode: 'fixed',
    hMode: 'fixed',
    constraintH: 'left-right',
    constraintV: 'top-bottom',
  }),
});

const createFeedTrackSlideNode = (storyId: string): FeedCardNode => createFeedNode({
  id: `feed-track-slide-${storyId}`,
  label: 'Feed Track Slide',
  type: 'container',
  layout: createFeedNodeLayout({
    mode: 'flow',
    selfPosition: 'in-flow',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    padding: 0,
    gap: 0,
    align: 'center',
    justify: 'start',
    direction: 'column',
    distribute: 'start',
    crossAlign: 'stretch',
    wMode: 'fixed',
    hMode: 'fill',
  }),
});

const createFeedStageNode = (): FeedCardNode => createFeedNode({
  id: 'feed-stage',
  label: 'Briefing Feed',
  type: 'container',
  layout: createFeedNodeLayout({
    mode: 'flow',
    selfPosition: 'in-flow',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    padding: 0,
    gap: 0,
    align: 'left',
    justify: 'start',
    direction: 'column',
    distribute: 'start',
    crossAlign: 'stretch',
    wMode: 'fixed',
    hMode: 'fixed',
  }),
});

const clampSlideIndex = (index: number, slideCount: number) => Math.max(0, Math.min(slideCount - 1, index));

const FeedSlideFrame = (props: {
  story: FeedStory;
  cardType: FeedCardTypeRecipe;
  imageSource: string;
  surfaceStateForTarget: (targetId: FeedMaterialTargetId, role: PreviewTargetRole) => MaterialRecipeState;
  selectedFeedTargetClass: (targetId: FeedMaterialTargetId) => string;
  cssProbe?: CssEmissionProbe;
  surfacePropsForRecipe: FeedSurfacePropsForRecipe;
  buttonPropsForRecipe: FeedSurfacePropsForRecipe;
  fingerprintActionPlan?: FingerprintHoldActionRuntimePlanV1;
  onUiAction?: UiActionEventHandler;
  suppressContent?: boolean;
}) => {
  const slideNode = createFeedSlideFrameNode(props.cardType.id);
  const mediaNode = slideNode.children?.[0] || createFeedNode({ id: `feed-slide-${props.cardType.id}-media`, label: 'Feed Media', type: 'container', layout: createFeedSlideLayerLayout() });
  const contentNode = slideNode.children?.[1] || createFeedNode({ id: `feed-slide-${props.cardType.id}-content`, label: 'Feed Content', type: 'container', layout: createFeedSlideLayerLayout() });
  const cardTargetId = () => feedCardMaterialTargetId(props.cardType.id);
  const visualState = () => props.surfaceStateForTarget(cardTargetId(), 'container');

  return (
    <FeedNodeFrame
      node={slideNode}
      targetId={cardTargetId()}
      role="container"
      targetClass={`main-material-feed-slide-frame ${props.selectedFeedTargetClass(cardTargetId())}`}
      cssProbe={props.cssProbe}
    >
      <MaterialSurfaceHost
        kind="panel"
        surfaceProps={props.surfacePropsForRecipe(props.cardType.surface, visualState())}
        padded={false}
        class="main-material-card-node-surface main-material-card-node-surface--background main-material-card-node-surface--slide"
      />
      <FeedNodeFrame
        node={mediaNode}
        targetId={`${cardTargetId()}:media`}
        role="static"
        targetClass="main-material-feed-media-layer"
        cssProbe={props.cssProbe}
      >
        <Show when={props.cardType.backgroundImage.enabled}>
          <img
            class="main-material-feed-background-image"
            src={props.imageSource}
            alt=""
            draggable={false}
            style={feedBackgroundImageCss(props.cardType.backgroundImage)}
          />
          <Show when={props.cardType.backgroundImage.fadeMode !== 'none'}>
            <span
              class={`main-material-feed-media-fade main-material-feed-media-fade--${props.cardType.backgroundImage.fadeMode}`}
              aria-hidden="true"
              style={feedMediaFadeCss(props.cardType.backgroundImage)}
            />
          </Show>
        </Show>
      </FeedNodeFrame>
      <FeedNodeFrame
        node={contentNode}
        targetId={`${cardTargetId()}:content`}
        role="static"
        targetClass="main-material-card-tree"
        cssProbe={props.cssProbe}
      >
        <Show when={!props.suppressContent}>
          <CanonicalFeedCardTree
            story={props.story}
            cardType={props.cardType}
            surfaceStateForTarget={props.surfaceStateForTarget}
            selectedFeedTargetClass={props.selectedFeedTargetClass}
            surfacePropsForRecipe={props.surfacePropsForRecipe}
            buttonPropsForRecipe={props.buttonPropsForRecipe}
            fingerprintActionPlan={props.fingerprintActionPlan}
            onUiAction={props.onUiAction}
          />
        </Show>
      </FeedNodeFrame>
    </FeedNodeFrame>
  );
};

const FeedDots = (props: {
  count: number;
  activeIndex: number;
  gap: number;
  onSelect: (index: number) => void;
}) => {
  const node = () => createFeedDotsNode(props.gap);
  return (
    <FeedNodeFrame
      node={node()}
      targetId="feed:dots"
      role="static"
      targetClass="main-material-feed-dots"
    >
      <div class="main-material-card-node-flow-stack">
        <For each={Array.from({ length: props.count })}>
          {(_, index) => (
            <button
              type="button"
              class={`main-material-feed-dot-button ${index() === props.activeIndex ? 'is-active' : ''}`}
              aria-label={`Show feed slide ${index() + 1}`}
              aria-current={index() === props.activeIndex ? 'true' : undefined}
              onClick={() => props.onSelect(index())}
            />
          )}
        </For>
      </div>
    </FeedNodeFrame>
  );
};

const FeedTrackSlide = (props: {
  story: FeedStory;
  cardType: FeedCardTypeRecipe;
  imageSource: string;
  surfaceStateForTarget: (targetId: FeedMaterialTargetId, role: PreviewTargetRole) => MaterialRecipeState;
  selectedFeedTargetClass: (targetId: FeedMaterialTargetId) => string;
  cssProbe?: CssEmissionProbe;
  surfacePropsForRecipe: FeedSurfacePropsForRecipe;
  buttonPropsForRecipe: FeedSurfacePropsForRecipe;
  fingerprintActionPlan?: FingerprintHoldActionRuntimePlanV1;
  onUiAction?: UiActionEventHandler;
  suppressContent?: boolean;
}) => {
  const node = createFeedTrackSlideNode(props.story.id);
  return (
    <FeedNodeFrame
      node={node}
      targetId={`feed:track:slide:${props.story.id}`}
      role="static"
      targetClass="main-material-feed-slide"
      cssProbe={props.cssProbe}
    >
      <div class="main-material-card-node-flow-stack">
        <FeedSlideFrame
          story={props.story}
          cardType={props.cardType}
          imageSource={props.imageSource}
          surfaceStateForTarget={props.surfaceStateForTarget}
          selectedFeedTargetClass={props.selectedFeedTargetClass}
          cssProbe={props.cssProbe}
          surfacePropsForRecipe={props.surfacePropsForRecipe}
          buttonPropsForRecipe={props.buttonPropsForRecipe}
          fingerprintActionPlan={props.fingerprintActionPlan}
          onUiAction={props.onUiAction}
          suppressContent={props.suppressContent}
        />
      </div>
    </FeedNodeFrame>
  );
};

const previewRoleForNode = (role: MaterialNodeRole): PreviewTargetRole =>
  role === 'momentary' ? 'momentary' : role === 'container' ? 'container' : 'text';

const feedSurfaceClassForNode = (node: MaterialNodeRecipe): string => {
  const isFingerprintHold = node.interaction?.type === 'FingerprintHoldActionRuntimePlanV1';
  if (node.kind === 'button') {
    return [
      'main-material-card-node-surface',
      'main-material-card-node-surface--button',
      isFingerprintHold ? 'main-material-card-node-surface--fingerprint-hold' : undefined,
    ].filter(Boolean).join(' ');
  }
  if (node.kind === 'text') {
    return `main-material-card-node-surface main-material-card-node-surface--text main-material-card-node--${node.content?.binding || 'unbound'}`;
  }
  return 'main-material-card-node-surface main-material-card-node-surface--background';
};

// Attach the feed-specific text fit/style/rich-text config (computed with the live
// story value) onto the bridged node's content, matching the prior FeedCardTreeNode so
// the canonical MaterialNodeRenderer reproduces the same autoscaled text.
const enrichFeedNodeContent = (
  cardType: FeedCardTypeRecipe,
  story: FeedStory,
  source: FeedCardNode,
  node: MaterialNodeRecipe,
  fingerprintActionPlan?: FingerprintHoldActionRuntimePlanV1,
): MaterialNodeRecipe => {
  if (source.id === 'reward-terms-group-fingerprint' && fingerprintActionPlan) {
    node.interaction = fingerprintActionPlan;
    if (node.layout?.style) {
      (node.layout.style as Record<string, string>)['--main-material-hold-duration'] = `${fingerprintActionPlan.holdDurationMs}ms`;
    }
  }
  if (node.content) {
    const value = feedNodeContentValue(story, source);
    const resolved = resolveFeedNodeTextStyle(cardType, source);
    const transform = feedRichTextTransform(resolved);
    const textTransform = transform === 'inherit' ? 'uppercase' : transform;
    const lineHeight = source.type === 'button'
      ? resolved.lineHeight + source.layout.gap / 100
      : resolved.lineHeight;
    node.content = {
      ...node.content,
      mode: 'plain',
      textRender: resolveFeedNodeRenderMode(source, value),
      fitMode: feedNodeFitMode(source, value),
      maxLines: feedNodeMaxLines(source, value),
      className: source.type === 'button'
        ? [
          'main-material-card-node-button-label',
          source.presentation === 'fingerprint-hold' ? 'main-material-fingerprint-hold-label' : undefined,
        ].filter(Boolean).join(' ')
        : 'main-material-card-node-text',
      style: feedTextCss(resolved) as JSX.CSSProperties,
      richText: (v: string) => (
        <FeedRichText value={v} cardType={cardType} style={resolveFeedNodeTextStyle(cardType, source)} />
      ),
      fit: {
        baseFontSize: Math.max(0.35, resolved.textSizeRem),
        minScale: 0.26,
        maxScale: 1,
        align: source.layout.align === 'right' ? 'right' : source.layout.align === 'center' ? 'center' : 'left',
        verticalAlign: source.layout.justify === 'end' ? 'bottom' : source.layout.justify === 'center' ? 'center' : 'top',
        verticalMetric: source.type === 'button' ? 'cap' : 'ink',
        textStyle: {
          fontFamily: resolved.textFontFamily === 'inherit' ? feedDefaultTextFontDin : resolved.textFontFamily,
          fontWeight: fontWeightTokenValue(resolved.fontWeight),
          fontStyle: resolved.fontStyle,
          letterSpacing: `${resolved.letterSpacing}em`,
          lineHeight,
          textTransform,
        },
      },
    };
  }
  if (node.children && source.children) {
    node.children = node.children.map((child, index) =>
      enrichFeedNodeContent(cardType, story, source.children![index], child, fingerprintActionPlan));
  }
  return node;
};

// Canonical render path: bridge each feed card node to a MaterialNodeRecipe, enrich its
// content, and render through MaterialNodeRenderer (self-sufficient layout from layout-1/2/3).
// DOM registration is bridged so Export DOM/CSS + the live inspector keep finding card nodes.
const CanonicalFeedCardTree = (props: {
  story: FeedStory;
  cardType: FeedCardTypeRecipe;
  surfaceStateForTarget: (targetId: FeedMaterialTargetId, role: PreviewTargetRole) => MaterialRecipeState;
  selectedFeedTargetClass: (targetId: FeedMaterialTargetId) => string;
  surfacePropsForRecipe: FeedSurfacePropsForRecipe;
  buttonPropsForRecipe: FeedSurfacePropsForRecipe;
  fingerprintActionPlan?: FingerprintHoldActionRuntimePlanV1;
  onUiAction?: UiActionEventHandler;
}) => {
  const registration = useMainMaterialDomRegistration();
  const targetIdFor = (node: MaterialNodeRecipe) =>
    feedMaterialTargetIdForNode(props.cardType.id, node.id) as FeedMaterialTargetId;
  const context = (): MaterialNodeRenderContext => ({
    treeId: props.cardType.id,
    targetIdForNode: (node) => targetIdFor(node),
    previewStateForNode: (node, role) => props.surfaceStateForTarget(targetIdFor(node), previewRoleForNode(role)),
    selectedClassForNode: (node) => props.selectedFeedTargetClass(targetIdFor(node)),
    // Frame class kept for selection-highlight CSS + base; the canonical inline layout
    // (display/position from layout-1/2/3) takes precedence over the class for positioning.
    classForNode: (node) => [
      'main-material-card-node',
      `main-material-card-node--${node.kind}-frame`,
    ].filter(Boolean).join(' '),
    childStackClassForNode: () => 'main-material-card-node-flow-stack',
    surfaceClassForNode: (node) => feedSurfaceClassForNode(node),
    surfacePropsForNode: (node, _role, state) => props.surfacePropsForRecipe(node.surface!, state),
    buttonPropsForNode: (node, _role, state) => props.buttonPropsForRecipe(node.surface!, state),
    buttonSizeForNode: () => 'sm',
    buttonFullWidthForNode: () => true,
    resolveBinding: (binding) => feedStoryValue(props.story, binding as never),
    onUiAction: props.onUiAction,
  });
  return (
    <MaterialNodeDomRegistrationProvider registration={registration}>
      <For each={props.cardType.children}>
        {(node) => (
          <MaterialNodeRenderer
            node={enrichFeedNodeContent(
              props.cardType,
              props.story,
              node,
              feedCardNodeToMaterialNode(props.cardType, node),
              props.fingerprintActionPlan,
            )}
            context={context()}
          />
        )}
      </For>
    </MaterialNodeDomRegistrationProvider>
  );
};

export const FeedCarousel = (props: {
  stories: FeedStory[];
  cardTypes: FeedCardTypes;
  activeStoryId: string;
  onActiveStoryChange: (storyId: string) => void;
  class: string;
  feed: FeedRecipe;
  surfaceStateForTarget: (targetId: FeedMaterialTargetId, role: PreviewTargetRole) => MaterialRecipeState;
  storyImageOverrides: Record<string, string>;
  selectedFeedTargetClass: (targetId: FeedMaterialTargetId) => string;
  cssProbe?: CssEmissionProbe;
  surfacePropsForRecipe: FeedSurfacePropsForRecipe;
  buttonPropsForRecipe: FeedSurfacePropsForRecipe;
  onInteractiveDragStart?: () => void;
  onUiAction?: UiActionEventHandler;
  suppressedCardTypeId?: string;
}) => {
  const [activeSlideIndex, setActiveSlideIndex] = createSignal(0);
  const [dragStartX, setDragStartX] = createSignal<number | null>(null);
  const [dragDeltaX, setDragDeltaX] = createSignal(0);
  createEffect(() => {
    const index = props.stories.findIndex((story) => story.id === props.activeStoryId);
    if (index >= 0 && index !== activeSlideIndex()) setActiveSlideIndex(index);
  });

  const lastSlideIndex = () => props.stories.length - 1;
  const canGoPrevious = () => activeSlideIndex() > 0;
  const canGoNext = () => activeSlideIndex() < lastSlideIndex();
  const feedStyle = () => feedLayoutCarouselCssVars(props.feed, activeSlideIndex(), dragDeltaX()) as JSX.CSSProperties;
  const stageNode = createFeedStageNode();
  const trackNode = createFeedTrackNode();
  const showSlide = (index: number) => {
    const nextIndex = clampSlideIndex(index, props.stories.length);
    setActiveSlideIndex(nextIndex);
    props.onActiveStoryChange(props.stories[nextIndex]?.id || props.stories[0].id);
  };
  const handleFeedPointerDown = (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
    setDragStartX(event.clientX);
    setDragDeltaX(0);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const handleFeedPointerMove = (event: PointerEvent) => {
    const startX = dragStartX();
    if (startX === null) return;
    const rawDeltaX = event.clientX - startX;
    if (Math.abs(rawDeltaX) > 8) props.onInteractiveDragStart?.();
    const isPullingPastStart = rawDeltaX > 0 && !canGoPrevious();
    const isPullingPastEnd = rawDeltaX < 0 && !canGoNext();
    const resistance = isPullingPastStart || isPullingPastEnd ? 0.28 : 1;
    setDragDeltaX(Math.max(-72, Math.min(72, rawDeltaX * resistance)));
  };
  const finishFeedDrag = () => {
    const deltaX = dragDeltaX();
    if (Math.abs(deltaX) > 38) {
      if (deltaX < 0 && canGoNext()) showSlide(activeSlideIndex() + 1);
      if (deltaX > 0 && canGoPrevious()) showSlide(activeSlideIndex() - 1);
    }
    setDragStartX(null);
    setDragDeltaX(0);
  };

  return (
    <FeedNodeFrame
      node={stageNode}
      targetId="feed:stage"
      role="static"
      targetClass={`main-material-feed-stage ${props.class} ${dragStartX() !== null ? 'is-dragging' : ''}`}
      style={feedStyle()}
      ariaLabel="Briefing feed"
      onPointerDown={handleFeedPointerDown}
      onPointerMove={handleFeedPointerMove}
      onPointerUp={finishFeedDrag}
      onPointerCancel={finishFeedDrag}
      onPointerLeave={finishFeedDrag}
    >
      <FeedNodeFrame
        node={trackNode}
        targetId="feed:track"
        role="static"
        targetClass="main-material-feed-track"
      >
        <div class="main-material-card-node-flow-stack">
          <For each={props.stories}>
            {(story) => {
              const cardType = () => props.cardTypes[story.cardTypeId] || props.cardTypes.card_type_01;
              const imageSource = () => props.storyImageOverrides[story.id] || story.image;
              return (
                <FeedTrackSlide
                  story={story}
                  cardType={cardType()}
                  imageSource={imageSource()}
                  surfaceStateForTarget={props.surfaceStateForTarget}
                  selectedFeedTargetClass={props.selectedFeedTargetClass}
                  cssProbe={props.cssProbe}
                  surfacePropsForRecipe={props.surfacePropsForRecipe}
                  buttonPropsForRecipe={props.buttonPropsForRecipe}
                  onUiAction={props.onUiAction}
                  suppressContent={story.cardTypeId === props.suppressedCardTypeId}
                />
              );
            }}
          </For>
        </div>
      </FeedNodeFrame>
      <FeedDots
        count={props.stories.length}
        activeIndex={activeSlideIndex()}
        gap={props.feed.newsGap}
        onSelect={showSlide}
      />
    </FeedNodeFrame>
  );
};
