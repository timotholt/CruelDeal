import {
  createFeedGlassRegionSurface,
  createFeedNode,
  createFeedNodeLayout,
  createFeedRegionSurface,
  createMissionBriefingCtaSurface,
  createMissionBriefingPanelSurface,
  createMissionBriefingTextSurface,
  type FeedCardNode,
  type FeedTextSlotId,
} from './mainMaterialFeedModel';

export const createTextBlockNode = (
  id: string,
  label: string,
  binding: FeedTextSlotId,
): FeedCardNode => createFeedNode({
  id,
  label,
  type: 'text',
  binding,
  surface: createMissionBriefingTextSurface(),
  layout: createFeedNodeLayout({
    mode: 'flow',
    selfPosition: 'in-flow',
    width: 100,
    height: 10,
    wMode: 'fill',
    hMode: 'hug',
    padding: 0,
    gap: 0,
  }),
});

export const createTwoColumnGroupNode = (
  id: string,
  left: FeedCardNode[] = [],
  right: FeedCardNode[] = [],
): FeedCardNode => createFeedNode({
  id,
  label: 'Two Column Group',
  type: 'container',
  surface: createFeedRegionSurface(),
  layout: createFeedNodeLayout({
    mode: 'flow',
    selfPosition: 'in-flow',
    direction: 'row',
    distribute: 'between',
    crossAlign: 'stretch',
    width: 100,
    height: 28,
    wMode: 'fill',
    hMode: 'hug',
    padding: 0,
    gap: 16,
  }),
  children: [
    createFeedNode({
      id: `${id}-left`,
      label: 'Left Column',
      type: 'container',
      surface: createFeedRegionSurface(),
      layout: createFeedNodeLayout({
        mode: 'flow',
        selfPosition: 'in-flow',
        direction: 'column',
        width: 52,
        height: 28,
        wMode: 'fill',
        hMode: 'hug',
        padding: 0,
        gap: 6,
      }),
      children: left,
    }),
    createFeedNode({
      id: `${id}-right`,
      label: 'Right Column',
      type: 'container',
      surface: createFeedRegionSurface(),
      layout: createFeedNodeLayout({
        mode: 'flow',
        selfPosition: 'in-flow',
        direction: 'column',
        width: 38,
        height: 28,
        wMode: 'fixed',
        hMode: 'hug',
        padding: 0,
        gap: 8,
        align: 'center',
        crossAlign: 'center',
      }),
      children: right,
    }),
  ],
});

export const createLabelValueStackNode = (
  id: string,
  labelBinding: FeedTextSlotId,
  valueBinding: FeedTextSlotId,
): FeedCardNode => createFeedNode({
  id,
  label: 'Label / Value Stack',
  type: 'container',
  surface: createFeedRegionSurface(),
  layout: createFeedNodeLayout({
    mode: 'flow',
    selfPosition: 'in-flow',
    direction: 'column',
    width: 100,
    height: 12,
    wMode: 'fill',
    hMode: 'hug',
    padding: 0,
    gap: 2,
  }),
  children: [
    createTextBlockNode(`${id}-label`, 'Label', labelBinding),
    createTextBlockNode(`${id}-value`, 'Value', valueBinding),
  ],
});

export const createFingerprintActionNode = (id: string): FeedCardNode => createFeedNode({
  id,
  label: 'Fingerprint Action',
  type: 'button',
  binding: 'contractCtaLabel',
  surface: createMissionBriefingCtaSurface(),
  layout: createFeedNodeLayout({
    mode: 'flow',
    selfPosition: 'in-flow',
    width: 100,
    height: 22,
    wMode: 'fill',
    hMode: 'fixed',
    padding: 8,
    gap: 4,
    align: 'center',
    justify: 'center',
  }),
});

export const createRewardTermsGroupNode = (id = 'reward-terms-group'): FeedCardNode => (
  createTwoColumnGroupNode(
    id,
    [
      createLabelValueStackNode(`${id}-deposit`, 'contractRewardLabel', 'contractRewardValue'),
      createLabelValueStackNode(`${id}-success`, 'contractRewardLabel', 'contractRewardValue'),
    ],
    [
      createFingerprintActionNode(`${id}-fingerprint`),
    ],
  )
);

export const createMissionBriefingCompositionTestBed = (): FeedCardNode[] => [
  createFeedNode({
    id: 'mission-briefing-panel',
    label: 'Mission Briefing Panel',
    type: 'container',
    surface: createMissionBriefingPanelSurface(),
    layout: createFeedNodeLayout({
      mode: 'flow',
      selfPosition: 'in-flow',
      direction: 'column',
      width: 52,
      height: 84,
      wMode: 'fixed',
      hMode: 'hug',
      padding: 18,
      gap: 12,
    }),
    children: [
      createTextBlockNode('mission-eyebrow', 'Contract Header', 'contractEyebrow'),
      createTextBlockNode('mission-title', 'Contract Title', 'contractTitle'),
      createTextBlockNode('mission-body', 'Contract Body', 'contractBody'),
      createRewardTermsGroupNode(),
    ],
  }),
  createFeedNode({
    id: 'mission-side-glass',
    label: 'Mission Side Glass',
    type: 'container',
    surface: createFeedGlassRegionSurface(),
    layout: createFeedNodeLayout({
      x: 58,
      y: 35,
      width: 32,
      height: 26,
      padding: 10,
      gap: 8,
      align: 'center',
      justify: 'center',
    }),
  }),
];

export const describeFeedNodeTree = (nodes: readonly FeedCardNode[], depth = 0): string[] => (
  nodes.flatMap((node) => [
    `${'  '.repeat(depth)}- ${node.id} [${node.type}]${node.binding ? ` -> ${node.binding}` : ''}`,
    ...describeFeedNodeTree(node.children || [], depth + 1),
  ])
);
