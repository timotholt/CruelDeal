import {
  cloneFeedCardType,
  createFeedNode,
  createFeedNodeLayout,
  createFeedRegionSurface,
  createMissionBriefingCtaSurface,
  createMissionBriefingPanelSurface,
  type FeedCardTypeRecipe,
  type FeedCardNode,
  type FeedTextSlotId,
} from './mainMaterialFeedModel';

export const createTextBlockNode = (
  id: string,
  label: string,
  binding: FeedTextSlotId,
  layout: Parameters<typeof createFeedNodeLayout>[0] = {},
): FeedCardNode => createFeedNode({
  id,
  label,
  type: 'text',
  binding,
  surface: createFeedRegionSurface(),
  layout: createFeedNodeLayout({
    mode: 'flow',
    selfPosition: 'in-flow',
    width: 100,
    height: 10,
    wMode: 'fixed',
    hMode: 'fixed',
    padding: 0,
    gap: 0,
    ...layout,
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
    height: 32,
    wMode: 'fixed',
    hMode: 'fixed',
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
        height: 100,
        wMode: 'fixed',
        hMode: 'fixed',
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
        height: 100,
        wMode: 'fixed',
        hMode: 'fixed',
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
): FeedCardNode => {
  const label = createTextBlockNode(`${id}-label`, 'Label', labelBinding, { height: 32 });
  const value = createTextBlockNode(`${id}-value`, 'Value', valueBinding, { height: 52 });
  return createFeedNode({
    id,
    label: 'Label / Value Stack',
    type: 'container',
    surface: createFeedRegionSurface(),
    layout: createFeedNodeLayout({
      mode: 'flow',
      selfPosition: 'in-flow',
      direction: 'column',
      width: 100,
      height: 42,
      wMode: 'fixed',
      hMode: 'fixed',
      padding: 0,
      gap: 2,
    }),
    children: [
      { ...label, sizing: 'fit', fitMode: 'single-line', maxLines: 1 },
      { ...value, sizing: 'fit', fitMode: 'single-line', maxLines: 1 },
    ],
  });
};

export const createFingerprintActionNode = (id: string): FeedCardNode => createFeedNode({
  id,
  label: 'Fingerprint Action',
  type: 'button',
  binding: 'contractCtaLabel',
  presentation: 'fingerprint-hold',
  holdDurationMs: 1400,
  surface: createMissionBriefingCtaSurface(),
  layout: createFeedNodeLayout({
    mode: 'flow',
    selfPosition: 'in-flow',
    width: 100,
    height: 100,
    wMode: 'fixed',
    hMode: 'fixed',
    padding: 8,
    gap: 4,
    align: 'center',
    justify: 'center',
  }),
});

export const createRewardSummaryNode = (id: string): FeedCardNode => ({
  ...createTextBlockNode(id, 'Reward Summary', 'contractRewardSummary', {
    width: 100,
    height: 100,
    wMode: 'fixed',
    hMode: 'fixed',
    padding: 0,
    align: 'left',
    justify: 'center',
  }),
  markup: 'on',
  sizing: 'flow',
  fitMode: 'paragraph',
  maxLines: 4,
});

export const createRewardTermsGroupNode = (id = 'reward-terms-group'): FeedCardNode => (
  createTwoColumnGroupNode(
    id,
    [
      createRewardSummaryNode(`${id}-summary`),
    ],
    [
      createFingerprintActionNode(`${id}-fingerprint`),
    ],
  )
);

export const createMissionBriefingV2FooterNode = (): FeedCardNode => {
  const footer = createRewardTermsGroupNode();
  return {
    ...footer,
    layout: createFeedNodeLayout({
      mode: 'flow',
      slot: 'footer',
      selfPosition: 'in-flow',
      direction: 'row',
      distribute: 'between',
      crossAlign: 'stretch',
      width: 100,
      height: 30,
      wMode: 'fixed',
      hMode: 'fixed',
      padding: 0,
      gap: 14,
      pushToEnd: true,
    }),
  };
};

export const createMissionBriefingCompositionTestBed = (): FeedCardNode[] => [
  createFeedNode({
    id: 'mission-briefing-panel',
    label: 'Mission Briefing Panel',
    type: 'container',
    surface: createMissionBriefingPanelSurface(),
    layout: createFeedNodeLayout({
      x: 5,
      y: 35,
      width: 47,
      height: 49,
      mode: 'absolute',
      selfPosition: 'absolute',
      direction: 'column',
      wMode: 'fixed',
      hMode: 'fixed',
      padding: 18,
      gap: 12,
    }),
    children: [
      createTextBlockNode('mission-eyebrow', 'Contract Header', 'contractEyebrow', { height: 10 }),
      createTextBlockNode('mission-title', 'Contract Title', 'contractTitle', { height: 24 }),
      createTextBlockNode('mission-body', 'Contract Body', 'contractBody', { height: 22 }),
      createRewardTermsGroupNode(),
    ],
  }),
];

export const createMissionBriefingV2CardType = (base: FeedCardTypeRecipe): FeedCardTypeRecipe => {
  const cardType = cloneFeedCardType(base);
  const missionPanel = cardType.children.find((node) => node.id === 'mission-briefing');
  if (missionPanel) {
    missionPanel.children = [createMissionBriefingV2FooterNode()];
  }
  return {
    ...cardType,
    id: 'card_type_04',
    name: 'Mission Briefing V2',
    description: 'Mission briefing V1 visual contract with a structured reward/fingerprint footer.',
  };
};

export const describeFeedNodeTree = (nodes: readonly FeedCardNode[], depth = 0): string[] => (
  nodes.flatMap((node) => [
    `${'  '.repeat(depth)}- ${node.id} [${node.type}]${node.binding ? ` -> ${node.binding}` : ''}`,
    ...describeFeedNodeTree(node.children || [], depth + 1),
  ])
);
