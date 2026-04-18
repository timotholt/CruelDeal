
import { useEffect, useState, useRef } from 'react';
import { GameEvent, VfxKey } from '../types';
import { audio } from '../services/audio';

export interface ActiveVfx {
    id: string;
    vfxId: VfxKey;
    laneIdx?: number;
    slotIdx?: number;
    playerId?: 'p1' | 'p2';
}

export const useEventSystem = (events: GameEvent[]) => {
    const [activeVfx, setActiveVfx] = useState<ActiveVfx[]>([]);
    const processedIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        events.forEach(event => {
            if (processedIds.current.has(event.id)) return;
            processedIds.current.add(event.id);

            // Strict Discriminated Union check
            if (event.type === 'SFX_PLAY') {
                 audio.play(event.sfxId);
            } 
            else if (event.type === 'VFX_PLAY') {
                 const vfxInstance: ActiveVfx = {
                     id: event.id,
                     vfxId: event.vfxId,
                     laneIdx: event.laneIdx,
                     slotIdx: event.slotIdx,
                     playerId: event.playerId
                 };
                 
                 setActiveVfx(prev => [...prev, vfxInstance]);

                 // Auto-cleanup VFX after animation duration
                 setTimeout(() => {
                     setActiveVfx(prev => prev.filter(v => v.id !== event.id));
                 }, 1000);
            }
        });
    }, [events]);

    return {
        activeVfx,
        // Manual triggers for UI interactions that aren't in GameState
        playClick: () => audio.playUiClick(),
        playSnap: () => audio.play('sfx_card_play', 1.2),
    };
};
