import type {
  MatchClient,
  MatchClientDebug,
  SeatCommandResult,
  SeatMatchInitialization,
} from '../client/matchClient';
import type { LaneId, Seat } from '../engine/types/ids';
import type {
  SeatBlockAck,
  SeatResyncRequest,
  SeatResyncResponse,
} from '../protocol/playerWire';
import type { FramePresentationTiming } from '../runtime/performanceTelemetry';
import type {
  SeatCardToken,
  SeatMatchSnapshot,
  SeatPresentationBlock,
} from '../runtime/projection';
import type {
  SeatCardStatReadModel,
  SeatLanePowerReadModel,
} from '../runtime/seatReadModels';

function wireClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * A transport-shaped MatchClient used by the authority conformance matrix.
 * Every public payload crosses a JSON boundary and every command crosses an
 * async boundary. It deliberately contains no fallback access to the wrapped
 * authority's canonical state.
 */
export class SerializedLoopbackMatchClient implements MatchClient {
  readonly bootstrap;
  readonly content;
  readonly debug: MatchClientDebug | null;

  readonly #authority: MatchClient;
  readonly #subscriptions = new Set<() => void>();
  #disposed = false;

  constructor(authority: MatchClient) {
    this.#authority = authority;
    this.bootstrap = wireClone(authority.bootstrap);
    this.content = wireClone(authority.content);
    this.debug = authority.debug === null
      ? null
      : this.#debugCapability(authority.debug);
    Object.freeze(this);
  }

  initialization(): SeatMatchInitialization {
    return wireClone(this.#authority.initialization());
  }

  snapshot(): SeatMatchSnapshot {
    return wireClone(this.#authority.snapshot());
  }

  subscribePresentationBlocks(
    subscriber: (block: SeatPresentationBlock) => void,
  ): () => void {
    if (this.#disposed) return () => undefined;
    const unsubscribeAuthority = this.#authority.subscribePresentationBlocks(
      block => subscriber(wireClone(block)),
    );
    let active = true;
    const unsubscribe = () => {
      if (!active) return;
      active = false;
      this.#subscriptions.delete(unsubscribe);
      unsubscribeAuthority();
    };
    this.#subscriptions.add(unsubscribe);
    return unsubscribe;
  }

  async stageCard(
    token: SeatCardToken,
    lane: LaneId,
  ): Promise<SeatCommandResult> {
    await Promise.resolve();
    return wireClone(await this.#authority.stageCard(token, lane));
  }

  async unstageCard(token: SeatCardToken): Promise<SeatCommandResult> {
    await Promise.resolve();
    return wireClone(await this.#authority.unstageCard(token));
  }

  async undoLastStagedCard(): Promise<SeatCommandResult> {
    await Promise.resolve();
    return wireClone(await this.#authority.undoLastStagedCard());
  }

  async endTurn(): Promise<SeatCommandResult> {
    await Promise.resolve();
    return wireClone(await this.#authority.endTurn());
  }

  async acknowledgePresentationBlock(
    ack: SeatBlockAck,
  ): Promise<SeatResyncResponse> {
    await Promise.resolve();
    return wireClone(await this.#authority.acknowledgePresentationBlock(
      wireClone(ack),
    ));
  }

  async resync(request: SeatResyncRequest): Promise<SeatResyncResponse> {
    await Promise.resolve();
    return wireClone(await this.#authority.resync(wireClone(request)));
  }

  cardStatReadModel(token: SeatCardToken): SeatCardStatReadModel | null {
    return wireClone(this.#authority.cardStatReadModel(token));
  }

  lanePowerReadModel(
    lane: LaneId,
    owner: Seat,
  ): SeatLanePowerReadModel | null {
    return wireClone(this.#authority.lanePowerReadModel(lane, owner));
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const unsubscribe of [...this.#subscriptions]) unsubscribe();
    this.#authority.dispose();
  }

  #debugCapability(debug: MatchClientDebug): MatchClientDebug {
    return Object.freeze({
      replay: () => wireClone(debug.replay()),
      performanceProfile: () => wireClone(debug.performanceProfile()),
      recordFramePresentationTiming: (timing: FramePresentationTiming) => {
        debug.recordFramePresentationTiming(wireClone(timing));
      },
    });
  }
}
