import '../../src/styles/ui-material-lab.css';
import '../../src/styles/main-material-preview.css';
import { MaterialNodeRenderer } from '../ui/material-node/MaterialNodeRenderer';
import type { MaterialNodeRenderContext } from '../ui/material-node/MaterialNodeTypes';
import { createDefaultFeedCardTypes, mockFeedStories } from './main-material/mainMaterialFeedModel';
import { feedStoryValue } from './main-material/mainMaterialFeedText';
import { feedCardTypeToMaterialNodeTree } from './main-material/mainMaterialFeedToNode';

// Dev-only harness: render a bridged feed card through the canonical MaterialNodeRenderer
// with SELF-SUFFICIENT layout (no feed render context, no feed CSS frame classes), so the
// canonical layout compiler + structure can be verified in isolation by node geometry.
export const CanonicalCardProofScreen = () => {
  const cardTypes = createDefaultFeedCardTypes() as Record<string, any>;
  const cardType = cardTypes.card_type_01;
  const story = (mockFeedStories as any[]).find((s) => s.cardTypeId === 'card_type_01');
  const tree = feedCardTypeToMaterialNodeTree(cardType);
  // Root fills the stage and becomes the positioning context for absolute children.
  tree.layout = { display: 'absolute', position: { inset: '0' } };
  const context: MaterialNodeRenderContext = {
    treeId: cardType.id,
    resolveBinding: (binding) => feedStoryValue(story, binding as never),
  };
  return (
    <div style={{ padding: '24px', background: '#14110b', 'min-height': '100vh' }}>
      <h1 style={{ color: '#f8d770', font: '600 14px sans-serif' }}>Canonical Card Proof</h1>
      <div
        id="canonical-card-stage"
        style={{ position: 'relative', width: '272px', height: '480px', 'margin-top': '16px', overflow: 'hidden', background: '#000' }}
      >
        <MaterialNodeRenderer node={tree} context={context} />
      </div>
    </div>
  );
};
