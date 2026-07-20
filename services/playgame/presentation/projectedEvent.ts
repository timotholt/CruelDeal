import type {
  JsonValue,
  SeatAnimationEvent,
  SeatCardToken,
} from '../runtime/projection';
import type { LaneId, Owner } from '../engine/types/ids';

export function eventString(
  event: SeatAnimationEvent,
  key: string,
): string | null {
  const value = event.data[key];
  return typeof value === 'string' ? value : null;
}

export function eventNumber(
  event: SeatAnimationEvent,
  key: string,
): number | null {
  const value = event.data[key];
  return typeof value === 'number' ? value : null;
}

export function eventBoolean(
  event: SeatAnimationEvent,
  key: string,
): boolean | null {
  const value = event.data[key];
  return typeof value === 'boolean' ? value : null;
}

export function eventRecord(
  event: SeatAnimationEvent,
  key: string,
): Readonly<Record<string, JsonValue>> | null {
  const value = event.data[key];
  return value !== null && !Array.isArray(value) && typeof value === 'object'
    ? value as Readonly<Record<string, JsonValue>>
    : null;
}

export function eventCardToken(
  event: SeatAnimationEvent,
): SeatCardToken | null {
  return eventString(event, 'card');
}

export function eventOwner(
  event: SeatAnimationEvent,
): Owner | null {
  const owner = eventString(event, 'owner');
  return owner === 'P0' || owner === 'P1' ? owner : null;
}

export function eventLane(
  event: SeatAnimationEvent,
  key = 'lane',
): LaneId | null {
  const lane = eventNumber(event, key);
  return lane === null ? null : lane as LaneId;
}
