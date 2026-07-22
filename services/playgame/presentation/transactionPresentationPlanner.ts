import type {
  SeatAbilityRef,
  SeatEffectTraceEntry,
  SeatEntityRef,
  SeatPresentationBlock,
  SeatTransactionFrame,
  SeatTransactionTimeline,
  SeatVisibleMatchState,
} from '../runtime/projection';
import { hashSeatVisibleState } from '../runtime/projection';
import type {
  EffectOutcomeReason,
  EffectTargetResult,
} from '../engine/types/effectTrace';

export interface DerivedTargetOutcome {
  readonly attemptToken: string;
  readonly attemptOrdinal: number;
  readonly operation: string;
  readonly target: SeatEntityRef;
  readonly result: EffectTargetResult;
  readonly blockedBy: readonly SeatEntityRef[];
  readonly reason: EffectOutcomeReason | null;
  readonly projectedFrameIndex: number;
}

export interface DerivedChildInsertionPoint {
  readonly childToken: string;
  readonly projectedFrameIndex: number;
  readonly afterParentOutcomeOrdinal: number | null;
  readonly beforeParentOutcomeOrdinal: number | null;
}

export interface DerivedEffectInvocation {
  readonly token: string;
  readonly parentToken: string | null;
  readonly source: SeatEntityRef;
  readonly ability: SeatAbilityRef;
  readonly candidates: readonly SeatEntityRef[];
  readonly depth: number;
  readonly outcomes: readonly DerivedTargetOutcome[];
  readonly children: readonly DerivedEffectInvocation[];
  readonly firstProjectedFrameIndex: number;
  readonly lastProjectedFrameIndex: number;
  readonly childInsertionPoints: readonly DerivedChildInsertionPoint[];
}

export interface EffectInvocationIndex {
  readonly roots: readonly DerivedEffectInvocation[];
  readonly size: number;
  get(token: string): DerivedEffectInvocation | undefined;
  values(): readonly DerivedEffectInvocation[];
}

export interface BeatFrameClaim {
  readonly kind: 'EXACT_CONTIGUOUS_RANGE';
  readonly firstPosition: number;
  readonly lastPosition: number;
  readonly projectedFrameIndexes: readonly [number, ...number[]];
}

export interface PresentationBeatAuthor {
  readonly kind: 'EXHAUSTIVE_SINGLE_FRAME';
  readonly eventDisposition: 'NONE' | 'EVENT_AUTHOR_REQUIRED';
  readonly effectDisposition: 'NONE' | 'EFFECT_TRACE_AUTHOR_REQUIRED';
}

export interface PresentationBeat {
  readonly id: string;
  readonly frames: readonly [SeatTransactionFrame, ...SeatTransactionFrame[]];
  readonly before: SeatVisibleMatchState;
  readonly after: SeatVisibleMatchState;
  readonly claim: BeatFrameClaim;
  readonly author: PresentationBeatAuthor;
}

export interface TransactionPresentationPlan {
  readonly timeline: SeatTransactionTimeline;
  readonly effects: EffectInvocationIndex;
  readonly beats: readonly PresentationBeat[];
}

interface MutableInvocation {
  readonly token: string;
  readonly parentToken: string | null;
  readonly source: SeatEntityRef;
  readonly ability: SeatAbilityRef;
  readonly candidates: readonly SeatEntityRef[];
  readonly depth: number;
  readonly firstProjectedFrameIndex: number;
  readonly outcomes: DerivedTargetOutcome[];
  readonly childTokens: string[];
  lastProjectedFrameIndex: number | null;
}

function stateEqual(
  left: SeatVisibleMatchState,
  right: SeatVisibleMatchState,
): boolean {
  return hashSeatVisibleState(left) === hashSeatVisibleState(right);
}

function entityRefKey(ref: SeatEntityRef): string {
  switch (ref.kind) {
    case 'CARD':
    case 'LOCATION':
      return `${ref.kind}:${ref.token}`;
    case 'LANE':
      return `LANE:${ref.laneId}`;
    case 'PLAYER':
      return `PLAYER:${ref.owner}`;
    case 'ZONE':
      return `ZONE:${ref.owner ?? 'NONE'}:${ref.zone}`;
    case 'SYSTEM':
      return `SYSTEM:${ref.systemId}`;
    case 'HIDDEN':
      return `HIDDEN:${ref.category}`;
  }
}

function assertOutcomeCounts(
  entry: Extract<SeatEffectTraceEntry, { kind: 'EFFECT_INVOCATION_COMPLETED' }>,
  invocation: MutableInvocation,
): void {
  const counts = {
    AFFECTED: 0,
    BLOCKED: 0,
    INVALIDATED: 0,
    NO_CHANGE: 0,
  } satisfies Record<EffectTargetResult, number>;
  for (const outcome of invocation.outcomes) counts[outcome.result] += 1;
  if (
    entry.attempted !== invocation.outcomes.length
    || entry.affected !== counts.AFFECTED
    || entry.blocked !== counts.BLOCKED
    || entry.invalidated !== counts.INVALIDATED
    || entry.unchanged !== counts.NO_CHANGE
  ) {
    throw new Error(
      `Effect invocation ${entry.invocationToken} completion checksum mismatch`,
    );
  }
}

function buildEffectInvocationIndex(
  frames: readonly SeatTransactionFrame[],
): EffectInvocationIndex {
  const mutable = new Map<string, MutableInvocation>();
  const active: string[] = [];
  const rootTokens: string[] = [];
  const attemptTokens = new Set<string>();
  let rootDepth: number | null = null;

  frames.forEach((frame, projectedFrameIndex) => {
    const entry = frame.effect;
    if (entry === null) return;
    switch (entry.kind) {
      case 'EFFECT_INVOCATION_STARTED': {
        if (mutable.has(entry.invocationToken)) {
          throw new Error(`Duplicate effect invocation ${entry.invocationToken}`);
        }
        const expectedParent = active.at(-1) ?? null;
        if (entry.parentInvocationToken !== expectedParent) {
          throw new Error(
            `Effect invocation ${entry.invocationToken} is not properly nested`,
          );
        }
        const parentDepth = expectedParent === null
          ? null
          : mutable.get(expectedParent)!.depth;
        if (expectedParent === null && rootDepth === null) rootDepth = entry.depth;
        if (
          (expectedParent === null && entry.depth !== rootDepth)
          || (parentDepth !== null && entry.depth !== parentDepth + 1)
        ) {
          throw new Error(
            `Effect invocation ${entry.invocationToken} has invalid depth ${entry.depth}`,
          );
        }
        const invocation: MutableInvocation = {
          token: entry.invocationToken,
          parentToken: entry.parentInvocationToken,
          source: entry.source,
          ability: entry.ability,
          candidates: Object.freeze([...entry.candidates]),
          depth: entry.depth,
          firstProjectedFrameIndex: projectedFrameIndex,
          outcomes: [],
          childTokens: [],
          lastProjectedFrameIndex: null,
        };
        mutable.set(entry.invocationToken, invocation);
        if (expectedParent === null) rootTokens.push(entry.invocationToken);
        else mutable.get(expectedParent)!.childTokens.push(entry.invocationToken);
        active.push(entry.invocationToken);
        return;
      }

      case 'EFFECT_TARGET_RESOLVED': {
        const invocation = mutable.get(entry.invocationToken);
        if (!invocation || active.at(-1) !== entry.invocationToken) {
          throw new Error(
            `Effect target ${entry.attemptToken} has no active invocation`,
          );
        }
        if (attemptTokens.has(entry.attemptToken)) {
          throw new Error(`Duplicate effect attempt ${entry.attemptToken}`);
        }
        if (entry.attemptOrdinal !== invocation.outcomes.length) {
          throw new Error(
            `Effect invocation ${entry.invocationToken} has non-contiguous attempt ordinals`,
          );
        }
        const candidate = invocation.candidates[entry.attemptOrdinal];
        if (!candidate || entityRefKey(candidate) !== entityRefKey(entry.target)) {
          throw new Error(
            `Effect invocation ${entry.invocationToken} target order differs from candidates`,
          );
        }
        attemptTokens.add(entry.attemptToken);
        invocation.outcomes.push(Object.freeze({
          attemptToken: entry.attemptToken,
          attemptOrdinal: entry.attemptOrdinal,
          operation: entry.operation,
          target: entry.target,
          result: entry.result,
          blockedBy: Object.freeze([...entry.blockedBy]),
          reason: entry.reason,
          projectedFrameIndex,
        }));
        return;
      }

      case 'EFFECT_INVOCATION_COMPLETED': {
        const invocation = mutable.get(entry.invocationToken);
        if (!invocation || active.at(-1) !== entry.invocationToken) {
          throw new Error(
            `Effect invocation ${entry.invocationToken} completed out of order`,
          );
        }
        if (invocation.lastProjectedFrameIndex !== null) {
          throw new Error(`Effect invocation ${entry.invocationToken} completed twice`);
        }
        assertOutcomeCounts(entry, invocation);
        invocation.lastProjectedFrameIndex = projectedFrameIndex;
        active.pop();
        return;
      }
    }
  });

  if (active.length > 0) {
    throw new Error(`Incomplete effect invocation ${active.at(-1)}`);
  }

  const built = new Map<string, DerivedEffectInvocation>();
  const materialize = (token: string): DerivedEffectInvocation => {
    const existing = built.get(token);
    if (existing) return existing;
    const invocation = mutable.get(token);
    if (!invocation || invocation.lastProjectedFrameIndex === null) {
      throw new Error(`Incomplete effect invocation ${token}`);
    }
    const children = invocation.childTokens.map(materialize);
    const childInsertionPoints = children.map((child) => {
      const before = invocation.outcomes
        .find(outcome => outcome.projectedFrameIndex > child.lastProjectedFrameIndex);
      const after = [...invocation.outcomes]
        .reverse()
        .find(outcome => outcome.projectedFrameIndex < child.firstProjectedFrameIndex);
      return Object.freeze({
        childToken: child.token,
        projectedFrameIndex: child.firstProjectedFrameIndex,
        afterParentOutcomeOrdinal: after?.attemptOrdinal ?? null,
        beforeParentOutcomeOrdinal: before?.attemptOrdinal ?? null,
      });
    });
    const value: DerivedEffectInvocation = Object.freeze({
      token: invocation.token,
      parentToken: invocation.parentToken,
      source: invocation.source,
      ability: invocation.ability,
      candidates: invocation.candidates,
      depth: invocation.depth,
      outcomes: Object.freeze([...invocation.outcomes]),
      children: Object.freeze(children),
      firstProjectedFrameIndex: invocation.firstProjectedFrameIndex,
      lastProjectedFrameIndex: invocation.lastProjectedFrameIndex,
      childInsertionPoints: Object.freeze(childInsertionPoints),
    });
    built.set(token, value);
    return value;
  };

  const roots = Object.freeze(rootTokens.map(materialize));
  for (const token of mutable.keys()) materialize(token);
  const values = Object.freeze([...built.values()].sort((left, right) => (
    left.firstProjectedFrameIndex - right.firstProjectedFrameIndex
  )));
  return Object.freeze({
    roots,
    size: built.size,
    get: (token: string) => built.get(token),
    values: () => values,
  });
}

function materializeTimeline(block: SeatPresentationBlock): SeatTransactionTimeline {
  if (block.frames.length === 0) {
    throw new Error(`Presentation block ${block.transactionId} has no visible Frames`);
  }
  if (block.publicRevision !== block.basePublicRevision + 1) {
    throw new Error(`Presentation block ${block.transactionId} has invalid revisions`);
  }
  if (hashSeatVisibleState(block.postState) !== block.postStateHash) {
    throw new Error(`Presentation block ${block.transactionId} failed its checksum`);
  }

  let before = block.preState;
  let priorCanonicalFrame = block.firstFrame - 1;
  let priorProjectedIndex = -1;
  const frames = block.frames.map((projected): SeatTransactionFrame => {
    if (
      projected.index <= priorProjectedIndex
      || projected.frame <= priorCanonicalFrame
      || projected.frame < block.firstFrame
      || projected.frame > block.lastFrame
    ) {
      throw new Error(`Presentation block ${block.transactionId} has unordered Frames`);
    }
    const frame: SeatTransactionFrame = Object.freeze({
      index: projected.index,
      transactionId: block.transactionId,
      frame: projected.frame,
      scope: projected.scope,
      event: projected.event,
      // Preserve the already-redacted wire trace entry exactly; the planner
      // derives indexes from it but never recreates or loosens the payload.
      effect: projected.effect,
      before,
      after: projected.after,
    });
    before = projected.after;
    priorProjectedIndex = projected.index;
    priorCanonicalFrame = projected.frame;
    return frame;
  });
  if (!stateEqual(before, block.postState)) {
    throw new Error(`Presentation block ${block.transactionId} does not reach postState`);
  }
  return Object.freeze({
    transactionId: block.transactionId,
    matchId: block.matchId,
    baseRevision: block.basePublicRevision,
    revision: block.publicRevision,
    viewerSeat: block.viewerSeat,
    frames: Object.freeze(frames),
    finalState: block.postState,
  });
}

function partitionSingleFrames(
  timeline: SeatTransactionTimeline,
): readonly PresentationBeat[] {
  const beats = timeline.frames.map((frame, position): PresentationBeat => Object.freeze({
    id: `${timeline.transactionId}:beat:${position}`,
    frames: Object.freeze([frame]) as unknown as readonly [SeatTransactionFrame],
    before: frame.before,
    after: frame.after,
    claim: Object.freeze({
      kind: 'EXACT_CONTIGUOUS_RANGE',
      firstPosition: position,
      lastPosition: position,
      projectedFrameIndexes: Object.freeze([frame.index]) as unknown as readonly [number],
    }),
    author: Object.freeze({
      kind: 'EXHAUSTIVE_SINGLE_FRAME',
      eventDisposition: frame.event === null ? 'NONE' : 'EVENT_AUTHOR_REQUIRED',
      effectDisposition: frame.effect === null ? 'NONE' : 'EFFECT_TRACE_AUTHOR_REQUIRED',
    }),
  }));

  const claims = beats.flatMap(beat => {
    const positions: number[] = [];
    for (
      let position = beat.claim.firstPosition;
      position <= beat.claim.lastPosition;
      position += 1
    ) positions.push(position);
    return positions;
  });
  if (
    claims.length !== timeline.frames.length
    || claims.some((position, index) => position !== index)
  ) {
    throw new Error(`Presentation block ${timeline.transactionId} has an invalid beat partition`);
  }
  return Object.freeze(beats);
}

/**
 * Pure boundary from one atomic seat wire block to an exact presentation plan.
 * It performs no DOM reads, state adoption, animation, or gameplay decisions.
 */
export class TransactionPresentationPlanner {
  plan(block: SeatPresentationBlock): TransactionPresentationPlan {
    const timeline = materializeTimeline(block);
    const effects = buildEffectInvocationIndex(timeline.frames);
    const beats = partitionSingleFrames(timeline);
    return Object.freeze({ timeline, effects, beats });
  }
}
