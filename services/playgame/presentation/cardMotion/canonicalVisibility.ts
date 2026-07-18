import type { CardId } from '../../engine/types/ids';

export interface CanonicalVisibilityLease {
  readonly sessionId: string;
  readonly cardId: CardId;
  readonly element: HTMLElement;
  readonly released: boolean;
  release(): void;
}

interface LeaseRecord {
  readonly sessionId: string;
  readonly cardId: CardId;
  readonly element: HTMLElement;
  readonly previousVisibility: string;
  released: boolean;
}

export class CanonicalVisibilityRegistry {
  private readonly ownerByCard = new Map<CardId, string>();
  private readonly leasesBySession = new Map<string, Set<LeaseRecord>>();

  get activeLeaseCount(): number {
    let count = 0;
    for (const leases of this.leasesBySession.values()) count += leases.size;
    return count;
  }

  acquire(
    sessionId: string,
    cardId: CardId,
    element: HTMLElement,
  ): CanonicalVisibilityLease {
    const owner = this.ownerByCard.get(cardId);
    if (owner && owner !== sessionId) {
      throw new Error(`Card ${cardId} visibility is already owned by motion session ${owner}`);
    }

    const existing = [...(this.leasesBySession.get(sessionId) ?? [])]
      .find((record) => record.cardId === cardId && record.element === element && !record.released);
    if (existing) return this.publicLease(existing);

    const record: LeaseRecord = {
      sessionId,
      cardId,
      element,
      previousVisibility: element.style.visibility,
      released: false,
    };
    this.ownerByCard.set(cardId, sessionId);
    const leases = this.leasesBySession.get(sessionId) ?? new Set<LeaseRecord>();
    leases.add(record);
    this.leasesBySession.set(sessionId, leases);
    element.dataset.cardMotionVisibilityOwner = sessionId;
    element.style.visibility = 'hidden';
    return this.publicLease(record);
  }

  releaseSession(sessionId: string): void {
    const leases = this.leasesBySession.get(sessionId);
    if (!leases) return;
    for (const record of [...leases]) this.releaseRecord(record);
    this.leasesBySession.delete(sessionId);
  }

  releaseAll(): void {
    for (const sessionId of [...this.leasesBySession.keys()]) {
      this.releaseSession(sessionId);
    }
  }

  private publicLease(record: LeaseRecord): CanonicalVisibilityLease {
    return {
      sessionId: record.sessionId,
      cardId: record.cardId,
      element: record.element,
      get released() {
        return record.released;
      },
      release: () => this.releaseRecord(record),
    };
  }

  private releaseRecord(record: LeaseRecord): void {
    if (record.released) return;
    record.released = true;
    const leases = this.leasesBySession.get(record.sessionId);
    leases?.delete(record);
    if (leases?.size === 0) this.leasesBySession.delete(record.sessionId);

    if (record.element.dataset.cardMotionVisibilityOwner === record.sessionId) {
      delete record.element.dataset.cardMotionVisibilityOwner;
      record.element.style.visibility = record.previousVisibility;
    }

    const stillOwned = [...(this.leasesBySession.get(record.sessionId) ?? [])]
      .some((candidate) => candidate.cardId === record.cardId && !candidate.released);
    if (!stillOwned && this.ownerByCard.get(record.cardId) === record.sessionId) {
      this.ownerByCard.delete(record.cardId);
    }
  }
}
