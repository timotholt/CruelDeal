import { For, Show, JSX } from 'solid-js';
import { useGame } from '../contexts/GameContext';
import { VfxKey } from '../types';
import { ExplosionVfx } from './vfx/ExplosionVfx';
import { WarpVfx } from './vfx/WarpVfx';

export const VfxLayer = () => {
    const { activeVfx } = useGame();

    const getPositionStyle = (vfx: any): JSX.CSSProperties => {
        if (vfx.laneIdx === undefined || vfx.slotIdx === undefined) return {};

        const laneCenters = ['16.66%', '50%', '83.33%'];
        const left = laneCenters[vfx.laneIdx];

        let top: string;
        let xOffset: string;
        
        if (vfx.playerId === 'p1') {
             top = vfx.slotIdx < 2 ? '60%' : '80%';
             // 25px -> 1.5625rem
             xOffset = (vfx.slotIdx % 2 === 0) ? '-1.5625rem' : '1.5625rem';

        } else {
             top = vfx.slotIdx < 2 ? '40%' : '20%';
             xOffset = (vfx.slotIdx % 2 === 0) ? '1.5625rem' : '-1.5625rem';
        }

        return {
            left,
            top,
            transform: `translate(-50%, -50%) translateX(${xOffset})`,
            position: 'absolute',
            'z-index': 50, 
            'pointer-events': 'none'
        };
    };

    const RenderEffect = (props: { id: VfxKey }) => {
        return (
            <Show when={props.id !== 'vfx_dust_motes'}>
                <Show when={props.id === 'vfx_explosion_small'}>
                    <ExplosionVfx />
                </Show>
                <Show when={props.id === 'vfx_warp_trail'}>
                    <WarpVfx />
                </Show>
                <Show when={props.id !== 'vfx_explosion_small' && props.id !== 'vfx_warp_trail'}>
                    <div class="w-10 h-10 bg-white/50 rounded-full animate-ping pointer-events-none" />
                </Show>
            </Show>
        );
    };

    return (
        <Show when={activeVfx().length > 0}>
            <div class="absolute inset-0 pointer-events-none overflow-hidden">
                <For each={activeVfx()}>
                    {(vfx) => (
                        <div style={getPositionStyle(vfx)}>
                            <RenderEffect id={vfx.vfxId} />
                        </div>
                    )}
                </For>
            </div>
        </Show>
    );
};
