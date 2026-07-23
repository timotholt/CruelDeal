/** Pure contracts for authored and compiled presentation timelines. */

declare const millisecondsBrand: unique symbol;

export type Milliseconds = number & {
  readonly [millisecondsBrand]: 'Milliseconds';
};

export function milliseconds(value: number): Milliseconds {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`Invalid millisecond value: ${String(value)}`);
  }
  return value as Milliseconds;
}

export type VisualTargetRef =
  | { readonly kind: 'CARD_ACTOR'; readonly card: string }
  | { readonly kind: 'CARD_CANONICAL'; readonly card: string }
  | { readonly kind: 'CARD_ACTOR_ROOT'; readonly card: string }
  | { readonly kind: 'CARD_ACTOR_RESTING_SHELL'; readonly card: string }
  | { readonly kind: 'CARD_ACTOR_FACE_SHELL'; readonly card: string }
  | { readonly kind: 'ZONE_ANCHOR'; readonly zone: string }
  | { readonly kind: 'LOCATION_ACTOR'; readonly lane: number }
  | { readonly kind: 'LOCATION_CANONICAL'; readonly lane: number }
  | { readonly kind: 'LOCATION_MAP'; readonly lane: number }
  | { readonly kind: 'LANE'; readonly lane: number }
  | { readonly kind: 'PLAYFIELD' }
  | { readonly kind: 'TURN_BANNER' }
  | { readonly kind: 'TURN_BANNER_BACKGROUND' };

export type VisualChannel =
  | 'layout'
  | 'opacity'
  | 'resting-pose'
  | 'face-turn'
  | 'scale'
  | 'map-opacity'
  | 'lane-position'
  | 'banner-pose'
  | 'effect';

export type AnimatableStyleProperty =
  | 'opacity'
  | 'transform'
  | 'translate'
  | 'filter'
  | 'clipPath'
  | 'left'
  | 'top'
  | 'width'
  | 'height'
  | 'backgroundColor'
  | 'color';

export interface RelativeStyleKeyframe {
  readonly atMs: Milliseconds;
  readonly styles: Readonly<Partial<Record<AnimatableStyleProperty, string | number>>>;
  /** Timing curve used by the segment arriving at this authored keyframe. */
  readonly easing?: string;
}

export interface ElementTrackSpec {
  readonly kind: 'ELEMENT';
  readonly id: string;
  readonly target: VisualTargetRef;
  readonly channel: VisualChannel;
  readonly keyframes: readonly RelativeStyleKeyframe[];
}

/** Geometry/effect tracks join this union at their owning migration checkpoints. */
export type VisualTrackSpec = ElementTrackSpec;

interface CueBase {
  readonly id: string;
  readonly atMs: Milliseconds;
}

export interface AudioCue extends CueBase {
  readonly kind: 'AUDIO';
  readonly sound: string;
  readonly volume: number;
}

export interface NoncriticalSurfaceSwapCue extends CueBase {
  readonly kind: 'SURFACE_SWAP';
  readonly surface: string;
  readonly variant: string;
}

export interface HapticCue extends CueBase {
  readonly kind: 'HAPTIC';
  readonly pattern: string;
}

export interface CameraCue extends CueBase {
  readonly kind: 'CAMERA';
  readonly effect: string;
}

export interface DiagnosticCue extends CueBase {
  readonly kind: 'DIAGNOSTIC';
  readonly label: string;
}

export type StoryboardCue =
  | AudioCue
  | NoncriticalSurfaceSwapCue
  | HapticCue
  | CameraCue
  | DiagnosticCue;

export interface StoryboardStep {
  readonly id: string;
  readonly durationMs: Milliseconds;
  readonly nextStepAfterMs: Milliseconds;
  readonly tracks: readonly VisualTrackSpec[];
  readonly cues: readonly StoryboardCue[];
}

export type BeatStoryboardSource =
  | {
      readonly kind: 'BEAT';
      readonly transactionId: string;
      readonly firstFrame: number;
      readonly lastFrame: number;
    }
  | { readonly kind: 'TRANSACTION_PRELUDE'; readonly transactionId: string }
  | { readonly kind: 'FOUNDATION_PROOF'; readonly proofId: string };

export interface BeatStoryboard {
  readonly id: string;
  readonly source: BeatStoryboardSource;
  readonly steps: readonly StoryboardStep[];
}

export interface ScheduledStep {
  readonly step: StoryboardStep;
  readonly ordinal: number;
  readonly startMs: Milliseconds;
  readonly endMs: Milliseconds;
}

export interface CompiledStyleKeyframe {
  readonly atMs: Milliseconds;
  readonly offset: number;
  readonly value: string | number;
  /** WAAPI timing curve for the segment from this keyframe to the next. */
  readonly easing?: string;
}

export interface CompiledVisualTrack {
  readonly id: string;
  readonly target: VisualTargetRef;
  readonly targetKey: string;
  readonly channel: VisualChannel;
  readonly property: AnimatableStyleProperty;
  readonly keyframes: readonly CompiledStyleKeyframe[];
  readonly totalDurationMs: Milliseconds;
}

export interface CompiledStoryboardCue {
  readonly cue: StoryboardCue;
  readonly absoluteTimeMs: Milliseconds;
  readonly stepOrdinal: number;
  readonly cueOrdinal: number;
}

export interface CompiledTimeline {
  readonly storyboardId: string;
  readonly source: BeatStoryboardSource;
  readonly totalDurationMs: Milliseconds;
  readonly steps: readonly ScheduledStep[];
  readonly tracks: readonly CompiledVisualTrack[];
  readonly cues: readonly CompiledStoryboardCue[];
}

export interface PresentationExpansionBudget {
  readonly maximumPrimitiveSteps: number;
  readonly maximumVisualTracks: number;
  readonly maximumTimedCues: number;
  readonly maximumAuthoredRoutineDepth: 16;
  readonly maximumCardActors: number;
  readonly maximumEffectActors: number;
}

export interface PresentationAnimationProfile {
  readonly id: 'normal' | 'reduced-motion' | 'debug-slow';
  readonly durationScale: number;
  readonly structuralMinimumMs: Milliseconds;
  readonly decorativeEffects: 'full' | 'reduced' | 'none';
  readonly playbackRate: number;
  readonly cueLatenessToleranceMs: Milliseconds;
}

export type PresentationOutcome = 'COMPLETED' | 'CANCELLED' | 'FAILED';

export function visualTargetKey(target: VisualTargetRef): string {
  switch (target.kind) {
    case 'CARD_ACTOR':
    case 'CARD_CANONICAL':
    case 'CARD_ACTOR_ROOT':
    case 'CARD_ACTOR_RESTING_SHELL':
    case 'CARD_ACTOR_FACE_SHELL':
      return `${target.kind}:${target.card}`;
    case 'ZONE_ANCHOR':
      return `${target.kind}:${target.zone}`;
    case 'LOCATION_ACTOR':
    case 'LOCATION_CANONICAL':
    case 'LOCATION_MAP':
    case 'LANE':
      return `${target.kind}:${target.lane}`;
    case 'PLAYFIELD':
    case 'TURN_BANNER':
    case 'TURN_BANNER_BACKGROUND':
      return target.kind;
  }
}
