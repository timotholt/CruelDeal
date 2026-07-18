import type { Manifest } from '../engine/manifest/types';
import type { ReplayResult, ReplayStep } from '../engine/replay';
import type { MatchLogEntry, MatchState } from '../engine/types/state';
import type { MatchRuntime } from '../runtime/matchRuntime';
import { renderRuntimeReplay } from '../runtime/replayExport';
import type { MatchRuntimeReplayExport } from '../runtime/contracts';
import {
  createReplayNameResolver,
  createReplayActorResolver,
  describeReplayStep,
  type ReplayStepDescription,
} from './replayPresentation';

export interface SnapDebugApi {
  getLiveState: () => MatchState;
  getLiveLog: () => readonly MatchLogEntry[];
  getReplayBundle: () => MatchRuntimeReplayExport;
  getReplayTimeline: () => ReplayResult;
  getStep: (cursor: number) => ReplayStep | null;
  getStepDescription: (cursor: number) => ReplayStepDescription | null;
  copyReplayJson: () => Promise<string>;
}

declare global {
  interface Window {
    __snapDebug?: SnapDebugApi;
  }
}

/** Installed only by the provider's import.meta.env.DEV branch. */
export function installSnapDebug(
  runtime: MatchRuntime,
  manifest: Manifest,
  exportReplay: () => MatchRuntimeReplayExport,
): () => void {
  const timeline = (): ReplayResult => renderRuntimeReplay(exportReplay(), manifest);
  const api: SnapDebugApi = {
    getLiveState: () => structuredClone(runtime.state()),
    getLiveLog: () => structuredClone(runtime.state().log),
    getReplayBundle: exportReplay,
    getReplayTimeline: timeline,
    getStep: (cursor) => timeline().steps[cursor] ?? null,
    getStepDescription: (cursor) => {
      const bundle = exportReplay();
      const replay = renderRuntimeReplay(bundle, manifest);
      const step = replay.steps[cursor] ?? null;
      if (!step) return null;
      return describeReplayStep(
        step,
        createReplayNameResolver(replay.steps, manifest),
        createReplayActorResolver(bundle),
      );
    },
    copyReplayJson: async () => {
      const json = JSON.stringify(exportReplay(), null, 2);
      await navigator.clipboard.writeText(json);
      return json;
    },
  };
  window.__snapDebug = api;
  return () => {
    if (window.__snapDebug === api) delete window.__snapDebug;
  };
}
