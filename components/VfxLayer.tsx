
import React from 'react';
import { useGame } from '../contexts/GameContext';
import { VfxKey } from '../types';
import { ExplosionVfx } from './vfx/ExplosionVfx';
import { WarpVfx } from './vfx/WarpVfx';

export const VfxLayer: React.FC = () => {
    const { activeVfx } = useGame();

    if (activeVfx.length === 0) return null;

    const getPositionStyle = (vfx: typeof activeVfx[0]): React.CSSProperties => {
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
            zIndex: 50, 
            pointerEvents: 'none'
        };
    };

    const renderEffect = (id: VfxKey) => {
        switch(id) {
            case 'vfx_explosion_small': return <ExplosionVfx />;
            case 'vfx_warp_trail': return <WarpVfx />;
            case 'vfx_dust_motes': return null; // Ambient handled by CSS/Background
            default: return <div className="w-10 h-10 bg-white/50 rounded-full animate-ping pointer-events-none"></div>;
        }
    };

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {activeVfx.map(vfx => (
                <div key={vfx.id} style={getPositionStyle(vfx)}>
                    {renderEffect(vfx.vfxId)}
                </div>
            ))}
        </div>
    );
};
