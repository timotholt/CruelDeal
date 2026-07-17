export type ExclusiveHostPaintSlot = 'host::before' | 'host::after';
export type SurfaceShellHelperSlot = 'helper.underlay' | 'helper.overlay';
export type SurfaceShellPaintSlot = ExclusiveHostPaintSlot | SurfaceShellHelperSlot;

export interface SurfaceShellAllocationRequest {
  layerId: string;
  preferredSlot: ExclusiveHostPaintSlot;
}

export interface SurfaceShellAllocationAssignment {
  layerId: string;
  slot: SurfaceShellPaintSlot;
}

export interface SurfaceShellAllocationIssue {
  layerIds: string[];
  preferredSlot: ExclusiveHostPaintSlot;
  helperSlot: SurfaceShellHelperSlot;
  message: string;
}

export type SurfaceShellAllocationResult =
  | {
    ok: true;
    assignments: SurfaceShellAllocationAssignment[];
    helpers: SurfaceShellHelperSlot[];
  }
  | {
    ok: false;
    issues: SurfaceShellAllocationIssue[];
  };

const helperForHostSlot: Record<ExclusiveHostPaintSlot, SurfaceShellHelperSlot> = {
  'host::before': 'helper.underlay',
  'host::after': 'helper.overlay',
};

/**
 * Allocates exclusive pseudo paint in authored order.
 *
 * The first request owns the host pseudo. A second request spills into the one
 * bounded helper on the same side of content. A third request is rejected
 * instead of growing the DOM.
 */
export const allocateBoundedSurfaceShell = (
  requests: readonly SurfaceShellAllocationRequest[],
): SurfaceShellAllocationResult => {
  const assignments: SurfaceShellAllocationAssignment[] = [];
  const helpers = new Set<SurfaceShellHelperSlot>();
  const requestsBySlot = new Map<ExclusiveHostPaintSlot, SurfaceShellAllocationRequest[]>();

  for (const request of requests) {
    const requestsForSlot = requestsBySlot.get(request.preferredSlot) ?? [];
    requestsForSlot.push(request);
    requestsBySlot.set(request.preferredSlot, requestsForSlot);
  }

  const issues: SurfaceShellAllocationIssue[] = [];
  for (const preferredSlot of ['host::before', 'host::after'] as const) {
    const requestsForSlot = requestsBySlot.get(preferredSlot) ?? [];
    const helperSlot = helperForHostSlot[preferredSlot];
    for (const [index, request] of requestsForSlot.entries()) {
      if (index === 0) {
        assignments.push({ layerId: request.layerId, slot: preferredSlot });
      } else if (index === 1) {
        assignments.push({ layerId: request.layerId, slot: helperSlot });
        helpers.add(helperSlot);
      } else {
        issues.push({
          layerIds: requestsForSlot.map((candidate) => candidate.layerId),
          preferredSlot,
          helperSlot,
          message: `${preferredSlot} and ${helperSlot} are both occupied; the bounded surface shell cannot allocate ${request.layerId}.`,
        });
      }
    }
  }

  if (issues.length) return { ok: false, issues };
  return {
    ok: true,
    assignments,
    helpers: [...helpers],
  };
};
