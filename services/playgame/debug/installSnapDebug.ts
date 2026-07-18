import type { Manifest } from '../engine/manifest/types';
import type { ReplayFrame, ReplayResult } from '../engine/replay';
import type { MatchLogEntry, MatchState } from '../engine/types/state';
import type { MatchRuntime } from '../runtime/matchRuntime';
import { renderRuntimeReplay } from '../runtime/replayExport';
import type { MatchRuntimeReplayExport } from '../runtime/contracts';
import {
  createReplayNameResolver,
  describeReplayFrame,
  type ReplayFrameDescription,
} from './replayPresentation';

export interface SnapDebugApi {
  getLiveState: () => MatchState;
  getLiveLog: () => readonly MatchLogEntry[];
  getReplayBundle: () => MatchRuntimeReplayExport;
  getReplayTimeline: () => ReplayResult;
  getFrame: (index: number) => ReplayFrame | null;
  getFrameDescription: (index: number) => ReplayFrameDescription | null;
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
    getFrame: (index) => timeline().frames[index] ?? null,
    getFrameDescription: (index) => {
      const replay = timeline();
      const frame = replay.frames[index] ?? null;
      if (!frame) return null;
      return describeReplayFrame(frame, createReplayNameResolver(replay.frames, manifest));
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
