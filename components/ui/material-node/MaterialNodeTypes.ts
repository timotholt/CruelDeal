import type { JSX } from 'solid-js';
import type {
  ButtonSize,
  MaterialEditorCapabilities,
  MaterialRecipe,
  MaterialRecipeState,
} from '../material-lab';
import type { MaterialTextFitOptions } from './MaterialTextContent';

export type MaterialNodeKind = 'container' | 'button' | 'text' | 'media' | 'slot';

export type MaterialNodeRole = 'static' | 'container' | 'text' | 'momentary' | 'selectable' | 'disclosure';

export type MaterialNodeContentMode = 'plain' | 'rich' | 'icon' | 'media' | 'none';
export type MaterialNodeTextRenderMode = 'raw' | 'rich' | 'fit';
export type MaterialNodeTextFitMode = 'single-line' | 'fixed-lines' | 'paragraph';

export interface MaterialNodeLayout {
  className?: string;
  style?: JSX.CSSProperties;
  display?: 'block' | 'flex' | 'grid' | 'absolute';
  direction?: 'row' | 'column';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  gap?: number;
  padding?: number;
  width?: string;
  height?: string;
  minWidth?: string;
  minHeight?: string;
  position?: {
    left?: string;
    right?: string;
    top?: string;
    bottom?: string;
    inset?: string;
  };
}

export interface MaterialNodeContent {
  mode?: MaterialNodeContentMode;
  text?: string;
  binding?: string;
  mediaSrc?: string;
  mediaAlt?: string;
  iconKey?: string;
  textRender?: MaterialNodeTextRenderMode;
  fitMode?: MaterialNodeTextFitMode;
  maxLines?: number;
  fit?: MaterialTextFitOptions;
  className?: string;
  style?: JSX.CSSProperties;
  richText?: (value: string) => JSX.Element;
}

export interface MaterialNodeSharedStyleRef {
  id: string;
  label: string;
}

export interface MaterialNodeRecipe {
  id: string;
  label: string;
  kind: MaterialNodeKind;
  role?: MaterialNodeRole;
  surface?: MaterialRecipe;
  layout?: MaterialNodeLayout;
  content?: MaterialNodeContent;
  capabilities?: Partial<MaterialEditorCapabilities>;
  sharedStyle?: MaterialNodeSharedStyleRef;
  children?: MaterialNodeRecipe[];
}

export interface MaterialNodeResolvedContent {
  text?: string;
  mediaSrc?: string;
  mediaAlt?: string;
  icon?: JSX.Element;
}

export interface MaterialNodeRenderContext {
  treeId: string;
  selectedNodeId?: string;
  hoveredNodeId?: string | null;
  pressedNodeId?: string | null;
  focusedNodeId?: string | null;
  activeNodeIds?: ReadonlySet<string>;
  forcePreview?: boolean;
  forcedState?: MaterialRecipeState;
  allOnScreenPreview?: boolean;
  resolveBinding?: (binding: string, node: MaterialNodeRecipe) => MaterialNodeResolvedContent | string | number | undefined;
  resolveIcon?: (iconKey: string, node: MaterialNodeRecipe) => JSX.Element | undefined;
  previewStateForNode?: (node: MaterialNodeRecipe, role: MaterialNodeRole) => MaterialRecipeState;
  targetIdForNode?: (node: MaterialNodeRecipe) => string;
  selectedClassForNode?: (node: MaterialNodeRecipe) => string;
  classForNode?: (node: MaterialNodeRecipe, role: MaterialNodeRole) => string;
  surfaceClassForNode?: (node: MaterialNodeRecipe, role: MaterialNodeRole) => string;
  surfacePropsForNode?: (
    node: MaterialNodeRecipe,
    role: MaterialNodeRole,
    visualState: MaterialRecipeState,
  ) => Record<string, unknown>;
  buttonPropsForNode?: (
    node: MaterialNodeRecipe,
    role: MaterialNodeRole,
    visualState: MaterialRecipeState,
  ) => Record<string, unknown>;
  buttonSizeForNode?: (node: MaterialNodeRecipe) => ButtonSize | undefined;
  buttonFullWidthForNode?: (node: MaterialNodeRecipe) => boolean;
  onNodeAction?: (node: MaterialNodeRecipe) => void;
  onPointerDown?: (node: MaterialNodeRecipe, event: PointerEvent) => void;
  onPointerUp?: (node: MaterialNodeRecipe, event: PointerEvent) => void;
}
