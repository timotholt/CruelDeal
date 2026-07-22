import type {
  CompiledTimeline,
  PresentationOutcome,
  VisualChannel,
} from './contracts';
import type { CueDispatchRecord } from './cueScheduler';

export interface StoryboardDiagnosticSnapshot {
  readonly storyboardId: string;
  readonly totalDurationMs: number;
  readonly steps: readonly { id: string; startMs: number; endMs: number }[];
  readonly tracks: readonly {
    id: string;
    target: string;
    channel: VisualChannel;
    property: string;
  }[];
  readonly cues: readonly {
    id: string;
    kind: string;
    atMs: number;
    dispatched: boolean;
  }[];
  readonly currentTimeMs: number;
  readonly outcome: PresentationOutcome | null;
}

export function storyboardDiagnosticSnapshot(
  timeline: CompiledTimeline,
  currentTimeMs: number,
  outcome: PresentationOutcome | null,
  cueRecords: readonly CueDispatchRecord[] = [],
): StoryboardDiagnosticSnapshot {
  const dispatched = new Set(cueRecords.map(record => record.cueId));
  return {
    storyboardId: timeline.storyboardId,
    totalDurationMs: timeline.totalDurationMs,
    steps: timeline.steps.map(step => ({
      id: step.step.id,
      startMs: step.startMs,
      endMs: step.endMs,
    })),
    tracks: timeline.tracks.map(track => ({
      id: track.id,
      target: track.targetKey,
      channel: track.channel,
      property: track.property,
    })),
    cues: timeline.cues.map(compiled => ({
      id: compiled.cue.id,
      kind: compiled.cue.kind,
      atMs: compiled.absoluteTimeMs,
      dispatched: dispatched.has(compiled.cue.id),
    })),
    currentTimeMs,
    outcome,
  };
}
