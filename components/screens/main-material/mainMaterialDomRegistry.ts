import { parseFeedMaterialTargetId } from './materialTargetIds';

export interface MaterialDomRegistryEntry {
  targetId: string;
  instanceId: string;
  element: HTMLElement;
}

export interface RegisteredDomAuditTarget {
  entry: MaterialDomRegistryEntry;
  exact: boolean;
}

export interface MainMaterialDomRegistry {
  createInstanceId: () => string;
  register: (targetId: string, instanceId: string, element: HTMLElement) => void;
  unregister: (instanceId: string) => void;
  liveEntries: () => MaterialDomRegistryEntry[];
  findTarget: (targetId: string) => RegisteredDomAuditTarget | null;
}

export const createMainMaterialDomRegistry = (
  onChange?: () => void,
): MainMaterialDomRegistry => {
  let instanceCounter = 0;
  const entries = new Map<string, MaterialDomRegistryEntry>();
  const notify = () => onChange?.();

  const liveEntries = () => (
    Array.from(entries.values()).filter((entry) => entry.element.isConnected)
  );

  return {
    createInstanceId: () => `material_${(instanceCounter += 1).toString().padStart(5, '0')}`,
    register: (targetId, instanceId, element) => {
      const current = entries.get(instanceId);
      if (current?.targetId === targetId && current.element === element) return;
      entries.set(instanceId, { targetId, instanceId, element });
      notify();
    },
    unregister: (instanceId) => {
      if (entries.delete(instanceId)) notify();
    },
    liveEntries,
    findTarget: (targetId) => {
      const live = liveEntries();
      const exact = live.find((entry) => entry.targetId === targetId);
      if (exact) return { entry: exact, exact: true };
      const feedTarget = parseFeedMaterialTargetId(targetId);
      if (!feedTarget?.nodeId) return null;
      const sameNode = live.find((entry) => entry.targetId.endsWith(`:node:${feedTarget.nodeId}`));
      return sameNode ? { entry: sameNode, exact: false } : null;
    },
  };
};

