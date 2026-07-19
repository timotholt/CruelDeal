import type { LocationCardInstanceId } from '../types/ids';
import type {
  InternalLocationRecord,
  LocationStore,
  MatchState,
} from '../types/state';

export type LocationRecords = Readonly<
  Record<LocationCardInstanceId, InternalLocationRecord>
>;

export function createLocationStoreInternal(
  records: LocationRecords = {},
): LocationStore {
  return records as unknown as LocationStore;
}

export function locationRecordsInternal(
  state: MatchState,
): LocationRecords {
  return state.locationStore as unknown as LocationRecords;
}

export function readLocationInternal(
  state: MatchState,
  locationId: LocationCardInstanceId,
): InternalLocationRecord | null {
  return locationRecordsInternal(state)[locationId] ?? null;
}

export function listLocationsInternal(
  state: MatchState,
): readonly InternalLocationRecord[] {
  return Object.values(locationRecordsInternal(state));
}

export function writeLocationRecordsInternal(
  state: MatchState,
  records: LocationRecords,
): MatchState {
  return { ...state, locationStore: createLocationStoreInternal(records) };
}
