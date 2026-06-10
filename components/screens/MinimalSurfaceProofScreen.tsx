import { createSignal, For, Show } from 'solid-js';
import '../../src/styles/ui-material-lab.css';
import { MaterialSurfaceHost } from '../ui/material-lab';
import { MinimalSurface } from '../ui/material-lab/MinimalSurface';
import {
  surfacePermutationGroups,
  surfacePermutations,
  type SurfacePermutation,
} from './minimal-surface/minimalSurfacePermutations';

// JSON-driven permutation gallery for the minimal 3-element surface.
// The same spec JSON drives the renderer(s) and the inspector panel.
// Modes: "compare" shows the old span renderer beside the new one;
// "difference" stacks new over old with mix-blend difference (black = identical).

const CELL_W = 220;
const CELL_H = 110;

const SurfaceCell = (props: {
  perm: SurfacePermutation;
  compare: boolean;
  difference: boolean;
  selected: boolean;
  onSelect: () => void;
}) => {
  const content = () => props.perm.text ?? 'Sample';
  const box: Record<string, string> = {
    width: `${CELL_W}px`, height: `${CELL_H}px`, position: 'relative', 'flex-shrink': '0',
  };

  const newSurface = () => (
    <MinimalSurface
      surfaceProps={props.perm.options}
      contentMode={props.perm.contentMode}
      rootProps={{ style: { position: 'absolute', inset: '0', width: '100%', height: '100%' } }}
    >
      <span>{content()}</span>
    </MinimalSurface>
  );

  const oldSurface = () => (
    <MaterialSurfaceHost
      kind="panel"
      surfaceProps={props.perm.options}
      padded={false}
      rootProps={{ style: { position: 'absolute', inset: '0', width: '100%', height: '100%' } }}
    >
      <span style={{ position: 'relative', 'z-index': '2' }}>{content()}</span>
    </MaterialSurfaceHost>
  );

  return (
    <div
      data-perm-cell={props.perm.id}
      data-perm-group={props.perm.group}
      title={props.perm.expect}
      onClick={props.onSelect}
      style={{
        padding: '10px',
        'border-radius': '8px',
        border: props.selected ? '1px solid #f8d770' : '1px solid #38332a',
        background: props.selected ? '#23201700' : 'transparent',
        cursor: 'pointer',
      }}
    >
      <div style={{ color: props.selected ? '#f8d770' : '#cfc6ad', font: '600 11px ui-sans-serif', 'margin-bottom': '6px', 'max-width': `${props.compare ? CELL_W * 2 + 10 : CELL_W}px`, overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }}>
        {props.perm.label}
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <Show when={props.compare && !props.difference}>
          <div data-perm-old={props.perm.id} style={box}>{oldSurface()}</div>
        </Show>
        <Show
          when={props.difference}
          fallback={<div data-perm-new={props.perm.id} style={box}>{newSurface()}</div>}
        >
          {/* difference mode: old below, new stacked over it with difference blend */}
          <div data-perm-diff={props.perm.id} style={{ ...box, isolation: 'isolate' }}>
            {oldSurface()}
            <div style={{ position: 'absolute', inset: '0', 'mix-blend-mode': 'difference' }}>
              {newSurface()}
            </div>
          </div>
        </Show>
      </div>
      <div data-perm-counts={props.perm.id} style={{ color: '#7d7660', font: '500 10px ui-sans-serif', 'margin-top': '5px' }}>
        {props.perm.group} · {props.perm.id}
      </div>
    </div>
  );
};

export const MinimalSurfaceProofScreen = () => {
  const groups = surfacePermutationGroups();
  const [activeGroup, setActiveGroup] = createSignal<string>('all');
  const [compare, setCompare] = createSignal(true);
  const [difference, setDifference] = createSignal(false);
  const [selectedId, setSelectedId] = createSignal<string>(surfacePermutations[0].id);

  const selected = () => surfacePermutations.find((p) => p.id === selectedId());
  const visibleGroups = () => (activeGroup() === 'all' ? groups : [activeGroup()]);
  const permsIn = (group: string) => surfacePermutations.filter((p) => p.group === group);

  // Self-debug hook: window.__permAudit() returns measurable facts per cell so an
  // agent can find broken cells without screenshots.
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__permAudit = () =>
      surfacePermutations.map((p) => {
        const host = document.querySelector(`[data-perm-new="${p.id}"], [data-perm-diff="${p.id}"]`);
        const root = host?.querySelector('.cd-surface--minimal');
        const oldHost = document.querySelector(`[data-perm-old="${p.id}"]`);
        const r = root?.getBoundingClientRect();
        return {
          id: p.id,
          group: p.group,
          rendered: !!root,
          nodes: root ? root.querySelectorAll('*').length : 0,
          oldNodes: oldHost ? (oldHost.querySelector('.cd-surface')?.querySelectorAll('*').length ?? 0) : null,
          w: r ? Math.round(r.width) : 0,
          h: r ? Math.round(r.height) : 0,
          fill: !!root?.querySelector('.cdm__fill'),
          light: !!root?.querySelector('.cdm__light'),
          wear: !!root?.querySelector('.cdm__wear'),
        };
      });
  }

  const bar: Record<string, string> = {
    position: 'sticky', top: '0', 'z-index': '50', display: 'flex', gap: '14px', 'align-items': 'center',
    padding: '12px 18px', background: '#15120ce8', 'border-bottom': '1px solid #38332a', 'backdrop-filter': 'blur(6px)',
  };

  return (
    <div style={{ background: '#15120c url(/art/login/editor-temp-bg.png) center/cover fixed', 'min-height': '100vh', height: '100vh', overflow: 'auto' }}>
      <div style={bar}>
        <span style={{ color: '#f8d770', font: '700 13px ui-sans-serif' }}>
          Minimal Surface Permutations ({surfacePermutations.length})
        </span>
        <select
          value={activeGroup()}
          onChange={(e) => setActiveGroup(e.currentTarget.value)}
          style={{ background: '#23201a', color: '#e8e0c8', border: '1px solid #4a4334', 'border-radius': '4px', padding: '4px 8px', font: '600 12px ui-sans-serif' }}
        >
          <option value="all">all groups</option>
          <For each={groups}>{(g) => <option value={g}>{g} ({permsIn(g).length})</option>}</For>
        </select>
        <label style={{ color: '#cfc6ad', font: '600 12px ui-sans-serif', display: 'flex', gap: '5px', 'align-items': 'center' }}>
          <input type="checkbox" checked={compare()} onChange={(e) => setCompare(e.currentTarget.checked)} />
          compare old
        </label>
        <label style={{ color: '#cfc6ad', font: '600 12px ui-sans-serif', display: 'flex', gap: '5px', 'align-items': 'center' }}>
          <input type="checkbox" checked={difference()} onChange={(e) => setDifference(e.currentTarget.checked)} />
          difference (black = identical)
        </label>
        <span style={{ color: '#7d7660', font: '500 11px ui-sans-serif' }}>
          hover a cell for expected behavior · click to inspect JSON
        </span>
      </div>

      <div style={{ display: 'flex', 'align-items': 'flex-start' }}>
        {/* gallery */}
        <div style={{ flex: '1', padding: '16px 18px 80px' }}>
          <For each={visibleGroups()}>
            {(group) => (
              <section data-perm-section={group}>
                <h2 style={{ color: '#efc85d', font: '700 13px ui-sans-serif', margin: '18px 0 10px', 'text-transform': 'uppercase', 'letter-spacing': '0.08em' }}>
                  // {group}
                </h2>
                <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '12px' }}>
                  <For each={permsIn(group)}>
                    {(perm) => (
                      <SurfaceCell
                        perm={perm}
                        compare={compare()}
                        difference={difference()}
                        selected={selectedId() === perm.id}
                        onSelect={() => setSelectedId(perm.id)}
                      />
                    )}
                  </For>
                </div>
              </section>
            )}
          </For>
        </div>

        {/* JSON inspector */}
        <aside style={{ width: '360px', 'flex-shrink': '0', position: 'sticky', top: '54px', 'max-height': 'calc(100vh - 54px)', overflow: 'auto', padding: '16px', 'border-left': '1px solid #38332a', background: '#15120cd9' }}>
          <Show when={selected()}>
            {(perm) => (
              <>
                <div style={{ color: '#f8d770', font: '700 13px ui-sans-serif' }}>{perm().label}</div>
                <div style={{ color: '#cfc6ad', font: '500 12px ui-sans-serif', margin: '8px 0 12px', 'line-height': '1.5' }}>
                  <b style={{ color: '#efc85d' }}>Expect:</b> {perm().expect}
                </div>
                <pre data-perm-json style={{ color: '#b9e8b4', background: '#0e0c08', border: '1px solid #38332a', 'border-radius': '6px', padding: '10px', font: '500 10.5px ui-monospace, monospace', 'white-space': 'pre-wrap', 'word-break': 'break-word' }}>
                  {JSON.stringify(perm(), null, 2)}
                </pre>
              </>
            )}
          </Show>
        </aside>
      </div>
    </div>
  );
};
