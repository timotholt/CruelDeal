import type { MaterialNodeRecipe, MaterialNodeRenderContext, MaterialNodeResolvedContent } from './MaterialNodeTypes';

export const resolveMaterialNodeContent = (
  node: MaterialNodeRecipe,
  context: MaterialNodeRenderContext,
): MaterialNodeResolvedContent => {
  const content = node.content;
  const resolved = content?.binding ? context.resolveBinding?.(content.binding, node) : undefined;
  const normalized: MaterialNodeResolvedContent = typeof resolved === 'object' && resolved !== null
    ? resolved
    : { text: resolved === undefined ? undefined : String(resolved) };

  return {
    text: content?.text ?? normalized.text,
    mediaSrc: content?.mediaSrc ?? normalized.mediaSrc,
    mediaAlt: content?.mediaAlt ?? normalized.mediaAlt,
    icon: content?.iconKey ? context.resolveIcon?.(content.iconKey, node) : normalized.icon,
  };
};
