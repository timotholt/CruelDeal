import type { CardId } from '../types/ids';
import type {
  InternalCardRecord,
  CardStore,
  MatchState,
} from '../types/state';

type CardRecords = Readonly<Record<CardId, InternalCardRecord>>;

/**
 * Reducer/setup-only constructor. The public CardStore contract is opaque so
 * gameplay, queries, runtime, and presentation cannot index raw records.
 */
export function createCardStoreInternal(records: CardRecords): CardStore {
  return records as unknown as CardStore;
}

/** Internal read seam used only by canonical card projections and reducers. */
export function cardRecordsInternal(
  state: Pick<MatchState, 'cardStore'>,
): CardRecords {
  return state.cardStore as unknown as CardRecords;
}

export function readCardInternal(
  state: Pick<MatchState, 'cardStore'>,
  cardId: CardId,
): InternalCardRecord | null {
  return cardRecordsInternal(state)[cardId] ?? null;
}

export function listCardsInternal(
  state: Pick<MatchState, 'cardStore'>,
): readonly InternalCardRecord[] {
  return Object.values(cardRecordsInternal(state));
}

export function writeCardRecordsInternal(
  state: MatchState,
  records: CardRecords,
): MatchState {
  return {
    ...state,
    cardStore: createCardStoreInternal(records),
  };
}
