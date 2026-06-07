import { createEffect, createSignal, For, JSX, Show } from 'solid-js';
import {
  fontWeightTokenValue,
  MaterialSurfaceHost,
  type MaterialRecipe,
  type MaterialRecipeState,
  type SurfaceOptions,
} from '../../ui/material-lab';
import { MaterialTextContent } from '../../ui/material-node';
import type { FeedNodeLayout } from './feedNodeLayoutCss';
import type { PreviewTargetRole } from './mainMaterialInteractionModel';
import { feedCardMaterialTargetId, feedMaterialTargetIdForNode, type FeedMaterialTargetId as MainFeedMaterialTargetId } from './materialTargetIds';
import { FeedNodeFrame, type CssEmissionProbe } from './mainMaterialFeedFrame';
import { FeedRichText } from './mainMaterialFeedRichText';
import {
  feedBackgroundImageCss,
  feedMediaFadeCss,
  feedNodeContentValue,
  feedNodeFitMode,
  feedNodeMaxLines,
  feedNodeSurfaceRecipe,
  feedRichTextTransform,
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

const FeedCardTreeNode = (props: {
  node: FeedCardNode;
  story: FeedStory;
  cardType: FeedCardTypeRecipe;
  surfaceStateForTarget: (targetId: FeedMaterialTargetId, role: PreviewTargetRole) => MaterialRecipeState;
  selectedFeedTargetClass: (targetId: FeedMaterialTargetId) => string;
  cssProbe?: CssEmissionProbe;
  surfacePropsForRecipe: FeedSurfacePropsForRecipe;
  buttonPropsForRecipe: FeedSurfacePropsForRecipe;
}) => {
  const resolvedTextStyle = () => resolveFeedNodeTextStyle(props.cardType, props.node);
  const textStyle = () => feedTextCss(resolvedTextStyle());
  const fitTextTransform = () => {
    const transform = feedRichTextTransform(resolvedTextStyle());
    return transform === 'inherit' ? 'uppercase' : transform;
  };
  const fitTextStyle = () => ({
    fontFamily: resolvedTextStyle().textFontFamily === 'inherit' ? feedDefaultTextFontDin : resolvedTextStyle().textFontFamily,
    fontWeight: fontWeightTokenValue(resolvedTextStyle().fontWeight),
    fontStyle: resolvedTextStyle().fontStyle,
    letterSpacing: `${resolvedTextStyle().letterSpacing}em`,
    lineHeight: resolvedTextStyle().lineHeight,
    textTransform: fitTextTransform(),
  });
  // A button has no flow children for LINE GAP to space, so for buttons repurpose
  // layout.gap as extra line spacing between multi-line label rows (em delta on the
  // line-height the autoscaler measures and renders with).
  const fitTextStyleResolved = () => {
    const base = fitTextStyle();
    if (props.node.type !== 'button') return base;
    return { ...base, lineHeight: base.lineHeight + props.node.layout.gap / 100 };
  };
  const content = () => feedNodeContentValue(props.story, props.node);
  const surfaceRecipe = () => feedNodeSurfaceRecipe(props.cardType, props.node);
  const targetId = () => feedMaterialTargetIdForNode(props.cardType.id, props.node.id);
  const nodeRole = (): PreviewTargetRole => props.node.type === 'button' ? 'momentary' : props.node.type === 'container' ? 'container' : 'text';
  const visualState = () => props.surfaceStateForTarget(targetId(), nodeRole());
  const targetClass = () => props.selectedFeedTargetClass(targetId());
  const materialTextRenderMode = () => resolveFeedNodeRenderMode(props.node, content());
  const fittedText = (className = 'main-material-card-node-text') => (
    <MaterialTextContent
      text={content()}
      renderMode={materialTextRenderMode()}
      fitMode={feedNodeFitMode(props.node, content())}
      maxLines={feedNodeMaxLines(props.node, content())}
      fit={{
        baseFontSize: Math.max(0.35, resolvedTextStyle().textSizeRem),
        minScale: 0.26,
        maxScale: 1,
        align: props.node.layout.align === 'right' ? 'right' : props.node.layout.align === 'center' ? 'center' : 'left',
        verticalAlign: props.node.layout.justify === 'end' ? 'bottom' : props.node.layout.justify === 'center' ? 'center' : 'top',
        verticalMetric: props.node.type === 'button' ? 'cap' : 'ink',
        textStyle: fitTextStyleResolved(),
      }}
      class={className}
      style={textStyle()}
      richText={(value) => <FeedRichText value={value} cardType={props.cardType} style={resolveFeedNodeTextStyle(props.cardType, props.node)} />}
    />
  );
  const hasFlowChildren = () => Boolean((props.node.children || []).some((child) => child.layout.mode === 'flow'));
  const useFlowStack = () => Boolean(props.node.binding) || hasFlowChildren();
  return (
    <Show
      when={props.node.type === 'container'}
      fallback={(
        <Show
          when={props.node.type === 'button'}
          fallback={(
            <FeedNodeFrame node={props.node} targetId={targetId()} role={nodeRole()} targetClass={targetClass()} cssProbe={props.cssProbe}>
              <MaterialSurfaceHost
                kind="panel"
                surfaceProps={props.surfacePropsForRecipe(surfaceRecipe(), visualState())}
                padded={false}
                class={`main-material-card-node-surface main-material-card-node-surface--text main-material-card-node--${props.node.binding || 'unbound'}`}
              >
                {fittedText()}
              </MaterialSurfaceHost>
            </FeedNodeFrame>
          )}
        >
          <FeedNodeFrame node={props.node} targetId={targetId()} role={nodeRole()} targetClass={targetClass()} cssProbe={props.cssProbe}>
            <MaterialSurfaceHost
              kind="button"
              surfaceProps={props.buttonPropsForRecipe(surfaceRecipe(), visualState())}
              buttonSize="sm"
              buttonFullWidth
              class="main-material-card-node-surface main-material-card-node-surface--button"
              label={fittedText('main-material-card-node-button-label')}
            />
          </FeedNodeFrame>
        </Show>
      )}
    >
      <FeedNodeFrame node={props.node} targetId={targetId()} role={nodeRole()} targetClass={targetClass()} cssProbe={props.cssProbe}>
        <MaterialSurfaceHost
          kind="panel"
          surfaceProps={props.surfacePropsForRecipe(surfaceRecipe(), visualState())}
          padded={false}
          class="main-material-card-node-surface main-material-card-node-surface--background"
        />
        <Show
          when={useFlowStack()}
          fallback={(
            <For each={props.node.children || []}>
              {(child) => (
                <FeedCardTreeNode
                  node={child}
                  story={props.story}
                  cardType={props.cardType}
                  surfaceStateForTarget={props.surfaceStateForTarget}
                  selectedFeedTargetClass={props.selectedFeedTargetClass}
                  cssProbe={props.cssProbe}
                  surfacePropsForRecipe={props.surfacePropsForRecipe}
                  buttonPropsForRecipe={props.buttonPropsForRecipe}
                />
              )}
            </For>
          )}
        >
          <div class="main-material-card-node-flow-stack">
            <Show when={props.node.binding}>
              {fittedText('main-material-card-node-text main-material-card-node-flow-text')}
            </Show>
            <For each={props.node.children || []}>
              {(child) => (
                <FeedCardTreeNode
                  node={child}
                  story={props.story}
                  cardType={props.cardType}
                  surfaceStateForTarget={props.surfaceStateForTarget}
                  selectedFeedTargetClass={props.selectedFeedTargetClass}
                  cssProbe={props.cssProbe}
                  surfacePropsForRecipe={props.surfacePropsForRecipe}
                  buttonPropsForRecipe={props.buttonPropsForRecipe}
                />
              )}
            </For>
          </div>
        </Show>
      </FeedNodeFrame>
    </Show>
  );
};

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
        <For each={props.cardType.children}>
          {(node) => (
            <FeedCardTreeNode
              node={node}
              story={props.story}
              cardType={props.cardType}
              surfaceStateForTarget={props.surfaceStateForTarget}
              selectedFeedTargetClass={props.selectedFeedTargetClass}
              cssProbe={props.cssProbe}
              surfacePropsForRecipe={props.surfacePropsForRecipe}
              buttonPropsForRecipe={props.buttonPropsForRecipe}
            />
          )}
        </For>
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
        />
      </div>
    </FeedNodeFrame>
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
  const feedStyle = () => ({
    '--main-card-gap': `${props.feed.cardGap}px`,
    '--main-news-gap': `${props.feed.newsGap}px`,
    '--main-feed-slide-index': activeSlideIndex(),
    '--main-feed-drag-x': `${dragDeltaX()}px`,
  }) as JSX.CSSProperties;
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
