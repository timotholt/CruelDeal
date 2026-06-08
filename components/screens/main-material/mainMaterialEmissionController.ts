import {
  serializeDomAuditNode,
  type DomAuditNode,
} from './mainMaterialDomAudit';
import type { RegisteredDomAuditTarget } from './mainMaterialDomRegistry';

export interface InspectorPosition {
  x: number;
  y: number;
}

export interface InspectorViewport {
  width: number;
  height: number;
}

export const createEmptyDomClassKeys = (): ReadonlySet<string> => new Set<string>();

export const toggleDomClassKey = (
  current: ReadonlySet<string>,
  key: string,
  className: string,
): { keys: ReadonlySet<string>; status: string } => {
  const next = new Set(current);
  if (next.has(key)) {
    next.delete(key);
    return { keys: next, status: `Restored class ${className}` };
  }
  next.add(key);
  return { keys: next, status: `Hid class ${className} in inspector` };
};

export const boundedEmissionInspectorPosition = (input: {
  pointer: InspectorPosition;
  offset: InspectorPosition;
  viewport: InspectorViewport;
  open: boolean;
}): InspectorPosition => {
  const inspectorWidth = input.open ? 420 : 210;
  const maxX = Math.max(8, input.viewport.width - inspectorWidth - 8);
  const maxY = Math.max(8, input.viewport.height - 72);
  return {
    x: Math.min(maxX, Math.max(8, input.pointer.x - input.offset.x)),
    y: Math.min(maxY, Math.max(8, input.pointer.y - input.offset.y)),
  };
};

export interface MainMaterialDomAuditRefreshOptions {
  targetId: string;
  hiddenClasses: ReadonlySet<string>;
  reportMissing?: boolean;
  findTarget: (targetId: string) => RegisteredDomAuditTarget | null;
  collectClassCssRules: (className: string) => string[];
  setSnapshot: (snapshot: DomAuditNode | null) => void;
  setStatus: (status: string) => void;
  clearMissingStatus: () => void;
}

export const refreshMainMaterialDomAudit = (options: MainMaterialDomAuditRefreshOptions) => {
  const match = options.findTarget(options.targetId);
  if (match) {
    options.setSnapshot(serializeDomAuditNode(
      match.entry.element,
      '0',
      options.hiddenClasses,
      options.collectClassCssRules,
    ));
    if (match.exact) {
      options.clearMissingStatus();
    } else {
      options.setStatus(`Showing ${match.entry.instanceId} (${match.entry.targetId}) for selected ${options.targetId}`);
    }
    return true;
  }
  if (options.reportMissing ?? true) {
    options.setSnapshot(null);
    options.setStatus(`No live DOM node for ${options.targetId}`);
  }
  return false;
};

export interface MainMaterialDomAuditRefreshQueueOptions {
  targetId: string;
  hiddenClasses: ReadonlySet<string>;
  maxAttempts?: number;
  selectedTargetId: () => string;
  refresh: (targetId: string, hiddenClasses: ReadonlySet<string>, reportMissing: boolean) => boolean;
  requestFrame: (callback: () => void) => number;
  cancelFrame: (frame: number) => void;
}

export const queueMainMaterialDomAuditRefresh = (options: MainMaterialDomAuditRefreshQueueOptions) => {
  const maxAttempts = options.maxAttempts ?? 6;
  let attempt = 0;
  let frame = 0;
  const run = () => {
    if (options.selectedTargetId() !== options.targetId) return;
    const isLastAttempt = attempt >= maxAttempts - 1;
    const matched = options.refresh(options.targetId, options.hiddenClasses, isLastAttempt);
    if (matched || isLastAttempt) return;
    attempt += 1;
    frame = options.requestFrame(run);
  };
  frame = options.requestFrame(run);
  return () => options.cancelFrame(frame);
};
