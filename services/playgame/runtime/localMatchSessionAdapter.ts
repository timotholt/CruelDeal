import {
  getCardRuntime,
} from '../engine/projections/cardRuntime';
import { getCardTemplate } from '../engine/projections/cardTemplate';
import { getCardCostModifiers } from '../engine/projections/cost';
import {
  getLocationRuntime,
} from '../engine/projections/locationRuntime';
import { getLocationTemplate } from '../engine/projections/locationTemplate';
import {
  getCardPowerModifiers,
  getLanePowerBreakdown,
} from '../engine/projections/power';
import {
  projectMatchContentCatalog,
  type MatchContentCatalog,
} from '../client/contentCatalog';
import type {
  MatchClient,
  MatchClientDebug,
  SeatCommandReceipt,
  SeatCommandResult,
  SeatMatchInitialization,
} from '../client/matchClient';
import type { Manifest } from '../engine/manifest/types';
import type {
  CardId,
  LaneId,
  LocationCardInstanceId,
  Seat,
} from '../engine/types/ids';
import type { MatchState } from '../engine/types/state';
import { storedPowerDelta } from '../engine/powerLedger';
import type {
  CommittedTransactionTimeline,
  IntentEnvelope,
  IntentReceipt,
  RuntimeIntent,
} from './contracts';
import type {
  SeatBlockAck,
  SeatCommand,
  SeatCommandEnvelope,
  SeatResyncRequest,
  SeatResyncResponse,
} from '../protocol/playerWire';
import {
  validateSeatBlockAckWire,
  validateSeatCommandEnvelopeWire,
  validateSeatResyncRequestWire,
} from '../protocol';
import type { MatchSession } from './matchSession';
import { renderRuntimeReplay } from './replayExport';
import type {
  FramePresentationTiming,
  MatchPerformanceProfile,
} from './performanceTelemetry';
import {
  projectBootstrapForSeat,
  overlaySeatPrivatePlan,
  projectMatchStateForSeat,
  projectPresentationBlockForSeat,
  projectSnapshotForSeat,
  projectTransactionTimelineForSeat,
  resolveSeatCardTokenForAuthority,
  type SeatBootstrap,
  type SeatCardToken,
  type SeatMatchSnapshot,
  type SeatPresentationBlock,
  type SeatTransactionTimeline,
} from './projection';
import type {
  SeatCardStatReadModel,
  SeatLanePowerReadModel,
} from './seatReadModels';
import type { DebugReplayTimeline } from '../debug/replayContracts';
import {
  annotateReplayEventJson,
  createReplayActorResolver,
  createReplayNameResolver,
  describeReplayStep,
} from '../debug/replayPresentation';

export interface LocalMatchSessionAdapterOptions {
  /** Server/fake-server identity claim; never inferred from browser input. */
  readonly developerAccess: boolean;
}

/**
 * Trusted local bridge between canonical MatchSession authority and the
 * player-facing provider contract. Normal client results never expose
 * canonical state or IDs. The separately authorized debug capability may
 * expose canonical replay events, while retaining a seat-safe board snapshot.
 */
export class LocalMatchSessionAdapter implements MatchClient {
  readonly bootstrap: SeatBootstrap;
  readonly content: MatchContentCatalog;
  readonly debug: MatchClientDebug | null;

  readonly #session: MatchSession;
  readonly #manifest: Manifest;
  readonly #viewerSeat: Seat;
  readonly #initialization: SeatMatchInitialization;
  readonly #subscriptions = new Set<() => void>();
  #unacknowledgedBlock: SeatPresentationBlock | null = null;
  #intentCounter = 0;
  #disposed = false;

  constructor(
    session: MatchSession,
    options: LocalMatchSessionAdapterOptions,
  ) {
    this.#session = session;
    this.#manifest = session.manifest;
    this.#viewerSeat = session.bootstrap.viewerSeat;
    this.bootstrap = projectBootstrapForSeat(session.bootstrap);
    this.content = projectMatchContentCatalog(session.manifest);
    this.debug = options.developerAccess
      ? Object.freeze({
          replay: () => this.#replay(),
          performanceProfile: () => this.performanceProfile(),
          recordFramePresentationTiming: timing => {
            this.recordFramePresentationTiming(timing);
          },
          installBrowserDebug: async () => {
            const { installSnapDebug } = await import('../debug/installSnapDebug');
            if (this.#disposed) return () => undefined;
            return installSnapDebug(
              this.#session.runtime,
              this.#manifest,
              this.#session.exportReplay,
            );
          },
        } satisfies MatchClientDebug)
      : null;

    const initialization = session.runtime.initialization();
    this.#initialization = Object.freeze({
      setup: projectSnapshotForSeat(
        session.bootstrap.matchId,
        initialization.setup.transaction.revision,
        session.runtime.planRevision(this.#viewerSeat),
        initialization.setup.finalState,
        this.#viewerSeat,
        session.manifest,
        session.runtime.interactionStatus(this.#viewerSeat),
      ),
      opening: this.#projectTimeline(initialization.opening),
    });
    Object.freeze(this);
  }

  initialization(): SeatMatchInitialization {
    return this.#initialization;
  }

  snapshot(): SeatMatchSnapshot {
    return projectSnapshotForSeat(
      this.bootstrap.matchId,
      this.#session.runtime.publicRevision(),
      this.#session.runtime.planRevision(this.#viewerSeat),
      this.#session.runtime.projectWorkingState(),
      this.#viewerSeat,
      this.#manifest,
      this.#session.runtime.interactionStatus(this.#viewerSeat),
    );
  }

  subscribeCommittedTransactions(
    subscriber: (timeline: SeatTransactionTimeline) => void,
  ): () => void {
    if (this.#disposed) return () => undefined;
    const unsubscribeRuntime = this.#session.runtime.subscribeCommittedTransactions(
      timeline => {
        this.#unacknowledgedBlock = this.#projectPresentationBlock(timeline);
        subscriber(this.#projectTimeline(timeline));
      },
    );
    let active = true;
    const unsubscribe = () => {
      if (!active) return;
      active = false;
      this.#subscriptions.delete(unsubscribe);
      unsubscribeRuntime();
    };
    this.#subscriptions.add(unsubscribe);
    return unsubscribe;
  }

  stageCard(
    token: SeatCardToken,
    lane: LaneId,
  ): Promise<SeatCommandResult> {
    return this.#submitCommand({ type: 'STAGE_CARD', token, lane });
  }

  unstageCard(token: SeatCardToken): Promise<SeatCommandResult> {
    return this.#submitCommand({ type: 'UNSTAGE_CARD', token });
  }

  undoLastStagedCard(): Promise<SeatCommandResult> {
    const state = this.#session.runtime.projectWorkingState();
    const cardId = [...state.stagedPlays]
      .reverse()
      .find(staged =>
        getCardRuntime(state, staged.cardId, this.#manifest)?.owner
          === this.#viewerSeat,
      )?.cardId ?? null;
    if (cardId === null) {
      return Promise.resolve(this.#illegal(
        'UNSTAGE_CARD',
        'The viewer has no staged card to undo.',
      ));
    }
    return this.#submit({ type: 'UNSTAGE_CARD', cardId });
  }

  endTurn(): Promise<SeatCommandResult> {
    return this.#submitCommand({ type: 'END_TURN' });
  }

  acknowledgePresentationBlock(
    ack: SeatBlockAck,
  ): Promise<SeatResyncResponse> {
    const validation = validateSeatBlockAckWire(ack);
    if (!validation.ok) return Promise.resolve(this.#snapshotResync());
    const value = validation.value;
    const retained = this.#unacknowledgedBlock;
    if (
      retained
      && value.version === 2
      && value.matchId === this.bootstrap.matchId
      && value.viewerSeat === this.#viewerSeat
      && value.publicRevision === retained.publicRevision
      && value.frame === retained.lastFrame
      && value.postStateHash === retained.postStateHash
    ) {
      this.#unacknowledgedBlock = null;
    }
    return Promise.resolve(this.#snapshotResync());
  }

  resync(request: SeatResyncRequest): Promise<SeatResyncResponse> {
    const validation = validateSeatResyncRequestWire(request);
    if (!validation.ok) return Promise.resolve(this.#snapshotResync());
    const value = validation.value;
    const retained = this.#unacknowledgedBlock;
    if (
      retained
      && value.matchId === this.bootstrap.matchId
      && value.viewerSeat === this.#viewerSeat
      && value.publicRevision === retained.basePublicRevision
      && value.frame < retained.firstFrame
    ) {
      return Promise.resolve({
        type: 'PRESENTATION_BLOCK',
        block: retained,
      });
    }
    return Promise.resolve(this.#snapshotResync());
  }

  performanceProfile(): MatchPerformanceProfile {
    return this.#session.runtime.performanceProfile();
  }

  #replay(): DebugReplayTimeline {
    const replayExport = this.#session.exportReplay();
    const rendered = renderRuntimeReplay(
      replayExport,
      this.#manifest,
    );
    const names = createReplayNameResolver(rendered.steps, this.#manifest);
    const actors = createReplayActorResolver(replayExport);
    const steps = rendered.steps.map((step) => {
      return {
        cursor: step.cursor,
        ...(step.transactionId === undefined
          ? {}
          : { transactionId: step.transactionId }),
        frame: step.frame,
        scope: step.scope,
        event: step.event,
        state: projectMatchStateForSeat(
          step.state,
          this.#viewerSeat,
          this.#manifest,
        ),
        description: describeReplayStep(step, names, actors),
        annotatedEventJson: annotateReplayEventJson(step, names),
      };
    });
    return {
      steps,
      finalState: steps.at(-1)?.state
        ?? projectMatchStateForSeat(
          rendered.finalState,
          this.#viewerSeat,
          this.#manifest,
        ),
    };
  }

  presentationStateForFrame(
    frame: SeatTransactionTimeline['frames'][number],
  ) {
    return overlaySeatPrivatePlan(
      frame.after,
      this.snapshot().state,
      this.#viewerSeat,
    );
  }

  recordFramePresentationTiming(timing: FramePresentationTiming): void {
    this.#session.performanceTelemetry.recordFramePresentation(timing);
  }

  cardStatReadModel(
    token: SeatCardToken,
  ): SeatCardStatReadModel | null {
    const state = this.#session.runtime.projectWorkingState();
    const visible = this.snapshot().state.cards.find(
      card => card.token === token,
    );
    if (!visible?.defId) return null;
    const cardId = resolveSeatCardTokenForAuthority(
      state,
      this.#viewerSeat,
      token,
    );
    if (cardId === null) return null;
    const card = getCardRuntime(state, cardId, this.#manifest);
    const template = card
      ? getCardTemplate(this.#manifest, card.defId)
      : null;
    if (!card || !template) return null;

    const basePower = template.basePower;
    const powerHistory = basePower === null
      ? []
      : card.powerLedger.map((entry, index, entries) => {
          const before = storedPowerDelta(
            { powerLedger: entries.slice(0, index) },
            basePower,
          );
          const after = storedPowerDelta(
            { powerLedger: entries.slice(0, index + 1) },
            basePower,
          );
          return {
            turn: entry.turn,
            frame: entry.frame,
            sourceLabel: this.#sourceLabel(state, entry.cause.sourceId),
            delta: after - before,
            total: basePower + after,
          };
        });
    const livePowerModifiers = getCardPowerModifiers(
      state,
      cardId,
      this.#manifest,
    ).map(entry => ({
      sourceLabel: this.#sourceLabel(state, entry.sourceId),
      delta: entry.delta,
    }));
    const liveCostModifiers = getCardCostModifiers(
      state,
      cardId,
      this.#manifest,
    ).map(entry => ({
      sourceLabel: this.#sourceLabel(state, entry.sourceId),
      delta: entry.delta,
    }));

    return {
      token,
      name: template.name,
      basePower,
      effectivePower: basePower === null ? null : visible.power ?? basePower,
      powerHistory,
      livePowerModifiers,
      baseCost: template.baseCost,
      effectiveCost: visible.cost ?? template.baseCost,
      costHistory: card.costHistory.map(entry => ({
        turn: entry.turn,
        frame: entry.frame,
        sourceLabel: this.#sourceLabel(state, entry.cause.sourceId),
        delta: entry.delta,
        total: Math.max(0, template.baseCost + entry.runningDelta),
      })),
      liveCostModifiers,
    };
  }

  lanePowerReadModel(
    lane: LaneId,
    owner: Seat,
  ): SeatLanePowerReadModel | null {
    const state = this.#session.runtime.projectWorkingState();
    if (!state.activeLaneOrder.includes(lane)) return null;
    const breakdown = getLanePowerBreakdown(
      state,
      lane,
      owner,
      this.#manifest,
    );
    return {
      lane,
      owner,
      cards: breakdown.cards.map(entry => ({
        label: this.#sourceLabel(state, entry.cardId),
        basePower: entry.basePower,
        permanentDelta: entry.permanentDelta,
        ongoingDelta: entry.ongoingDelta,
        finalPower: entry.finalCardPower,
      })),
      cardSubtotal: breakdown.cardSubtotal,
      laneAdditions: breakdown.laneAdditions.map(entry => ({
        sourceLabel: this.#sourceLabel(state, entry.sourceId),
        delta: entry.delta,
      })),
      subtotalAfterAdditions: breakdown.subtotalAfterAdditions,
      multipliers: breakdown.multipliers.map(entry => ({
        sourceLabel: this.#sourceLabel(state, entry.sourceId),
        factor: entry.factor,
      })),
      effectiveMultiplier: breakdown.effectiveMultiplier,
      total: breakdown.total,
    };
  }

  #projectTimeline(
    timeline: CommittedTransactionTimeline,
  ): SeatTransactionTimeline {
    return projectTransactionTimelineForSeat(
      timeline,
      this.#viewerSeat,
      this.#manifest,
      state => this.#session.runtime.projectWorkingState(state),
    );
  }

  #projectPresentationBlock(
    timeline: CommittedTransactionTimeline,
  ): SeatPresentationBlock {
    return projectPresentationBlockForSeat(
      timeline,
      this.#viewerSeat,
      this.#manifest,
      state => this.#session.runtime.projectWorkingState(state),
    );
  }

  #snapshotResync(): SeatResyncResponse {
    return {
      type: 'SNAPSHOT',
      snapshot: this.snapshot(),
    };
  }

  #resolveOwnedCard(
    token: SeatCardToken,
    expected: 'HAND' | 'STAGED',
  ): CardId | null {
    const state = this.#session.runtime.projectWorkingState();
    const cardId = resolveSeatCardTokenForAuthority(
      state,
      this.#viewerSeat,
      token,
    );
    if (cardId === null) return null;
    const card = getCardRuntime(state, cardId, this.#manifest);
    if (!card || card.owner !== this.#viewerSeat) return null;
    if (expected === 'HAND') return card.zone === 'HAND' ? cardId : null;
    return state.stagedPlays.some(staged => staged.cardId === cardId)
      ? cardId
      : null;
  }

  #sourceLabel(
    state: MatchState,
    sourceId: string,
  ): string {
    const card = getCardRuntime(
      state,
      sourceId as CardId,
      this.#manifest,
    );
    if (card) {
      return getCardTemplate(this.#manifest, card.defId)?.name ?? card.defId;
    }
    const location = getLocationRuntime(
      state,
      sourceId as LocationCardInstanceId,
      this.#manifest,
    );
    if (location) {
      return getLocationTemplate(this.#manifest, location.defId)?.name
        ?? location.defId;
    }
    return sourceId;
  }

  async #submit(intent: RuntimeIntent): Promise<SeatCommandResult> {
    if (this.#disposed) {
      return this.#illegal(intent.type, 'The match client is disposed.');
    }
    const envelope: IntentEnvelope = {
      matchId: this.bootstrap.matchId,
      seat: this.#viewerSeat,
      intentId:
        `local-adapter-${this.#viewerSeat}-${++this.#intentCounter}`
        + `-${intent.type.toLowerCase()}`,
      expectedPublicRevision: this.#session.runtime.publicRevision(),
      expectedPlanRevision: this.#session.runtime.planRevision(this.#viewerSeat),
      intent,
    };
    const result = await this.#session.runtime.submitIntent(envelope);
    if (result.status === 'duplicate') {
      return {
        status: 'duplicate',
        matchId: result.matchId,
        seat: result.seat,
        intentId: result.intentId,
        original: this.#projectReceipt(result.original),
      };
    }
    return this.#projectReceipt(result);
  }

  async #submitCommand(command: SeatCommand): Promise<SeatCommandResult> {
    if (this.#disposed) {
      return this.#illegal(command.type, 'The match client is disposed.');
    }
    const envelope: SeatCommandEnvelope = {
      version: 2,
      matchId: this.bootstrap.matchId,
      commandId:
        `local-adapter-${this.#viewerSeat}-${++this.#intentCounter}`
        + `-${command.type.toLowerCase()}`,
      expectedPublicRevision: this.#session.runtime.publicRevision(),
      expectedPlanRevision: this.#session.runtime.planRevision(this.#viewerSeat),
      command,
    };
    const validation = validateSeatCommandEnvelopeWire(envelope);
    if (!validation.ok) {
      return this.#illegal(
        command.type,
        validation.issues.map(issue => `${issue.path}: ${issue.message}`).join('; '),
      );
    }
    const intent = this.#commandToRuntimeIntent(validation.value.command);
    if (typeof intent === 'string') {
      return this.#illegal(command.type, intent);
    }
    return this.#submitWithIdentity(envelope.commandId, intent);
  }

  #commandToRuntimeIntent(command: SeatCommand): RuntimeIntent | string {
    switch (command.type) {
      case 'STAGE_CARD': {
        const cardId = this.#resolveOwnedCard(command.token, 'HAND');
        return cardId === null
          ? 'Unknown, stale, or non-hand card token.'
          : { type: 'STAGE_CARD', cardId, lane: command.lane };
      }
      case 'UNSTAGE_CARD': {
        const cardId = this.#resolveOwnedCard(command.token, 'STAGED');
        return cardId === null
          ? 'Unknown, stale, or non-staged card token.'
          : { type: 'UNSTAGE_CARD', cardId };
      }
      case 'UNDO_TURN':
        return { type: 'UNDO_TURN' };
      case 'END_TURN':
        return { type: 'END_TURN' };
      case 'CONCEDE':
        return { type: 'CONCEDE' };
    }
  }

  async #submitWithIdentity(
    intentId: string,
    intent: RuntimeIntent,
  ): Promise<SeatCommandResult> {
    if (this.#disposed) {
      return this.#illegal(intent.type, 'The match client is disposed.');
    }
    const envelope: IntentEnvelope = {
      matchId: this.bootstrap.matchId,
      seat: this.#viewerSeat,
      intentId,
      expectedPublicRevision: this.#session.runtime.publicRevision(),
      expectedPlanRevision: this.#session.runtime.planRevision(this.#viewerSeat),
      intent,
    };
    const result = await this.#session.runtime.submitIntent(envelope);
    if (result.status === 'duplicate') {
      return {
        status: 'duplicate',
        matchId: result.matchId,
        seat: result.seat,
        intentId: result.intentId,
        original: this.#projectReceipt(result.original),
      };
    }
    return this.#projectReceipt(result);
  }

  #projectReceipt(
    result: IntentReceipt,
  ): SeatCommandReceipt {
    switch (result.status) {
      case 'accepted':
        return {
          status: result.status,
          matchId: result.matchId,
          seat: result.seat,
          intentId: result.intentId,
          publicRevision: result.publicRevision,
          planRevision: result.planRevision,
          commit: result.commit,
        };
      case 'illegal':
        return {
          status: result.status,
          matchId: result.matchId,
          seat: result.seat,
          intentId: result.intentId,
          currentPublicRevision: result.currentPublicRevision,
          currentPlanRevision: result.currentPlanRevision,
          code: result.code,
          ...(result.message === undefined ? {} : { message: result.message }),
        };
      case 'stale-public':
        return {
          status: result.status,
          matchId: result.matchId,
          seat: result.seat,
          intentId: result.intentId,
          expectedPublicRevision: result.expectedPublicRevision,
          currentPublicRevision: result.currentPublicRevision,
          currentPlanRevision: result.currentPlanRevision,
          resyncRequired: result.resyncRequired,
        };
      case 'stale-plan':
        return {
          status: result.status,
          matchId: result.matchId,
          seat: result.seat,
          intentId: result.intentId,
          expectedPlanRevision: result.expectedPlanRevision,
          currentPublicRevision: result.currentPublicRevision,
          currentPlanRevision: result.currentPlanRevision,
        };
    }
  }

  #illegal(
    intentType: RuntimeIntent['type'],
    message: string,
  ): SeatCommandReceipt {
    return {
      status: 'illegal' as const,
      matchId: this.bootstrap.matchId,
      seat: this.#viewerSeat,
      intentId:
        `local-adapter-${this.#viewerSeat}-${++this.#intentCounter}`
        + `-${intentType.toLowerCase()}`,
      currentPublicRevision: this.#session.runtime.publicRevision(),
      currentPlanRevision: this.#session.runtime.planRevision(this.#viewerSeat),
      code: 'RULES_INVALID' as const,
      message,
    };
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const unsubscribe of [...this.#subscriptions]) unsubscribe();
    this.#subscriptions.clear();
  }
}
