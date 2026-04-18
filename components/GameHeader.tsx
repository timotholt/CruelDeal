
import React from 'react';
import { useGame } from '../contexts/GameContext';
import { PlayerAvatar } from './game/PlayerAvatar';
import { PremiumHeaderBase } from './ui/PremiumHeaderBase';

export const GameHeader: React.FC = () => {
    const { gameState } = useGame();
    
    if (!gameState) return (
        <PremiumHeaderBase className="pt-1 pb-2 px-1">
            <div className="w-full h-8 animate-pulse bg-white/5 rounded-lg" />
        </PremiumHeaderBase>
    );

    const isP1Priority = gameState.priority === 'p1';

    return (
        <PremiumHeaderBase 
            className="pt-1 pb-2 px-1"
            innerClassName="justify-between items-start"
        >
            {/* Player 1 (Left) */}
            <div>
                <PlayerAvatar 
                    name="PLAYER 1"
                    label="YOU"
                    hasPriority={isP1Priority}
                    color="indigo"
                    side="left"
                />
            </div>

            {/* Turn Indicator (Center) */}
            {gameState.winner === null && (
                <div className="mt-1 flex flex-col items-center justify-center">
                    <div className="text-base font-black text-white tracking-widest drop-shadow-[0_0.125rem_4px_rgba(0,0,0,0.8)] uppercase italic">
                        Turn {gameState.turn}
                    </div>
                </div>
            )}

            {/* Player 2 (Right) */}
            <div>
                <PlayerAvatar 
                    name="OPPONENT"
                    label="OPP"
                    hasPriority={!isP1Priority}
                    color="red"
                    side="right"
                />
            </div>
        </PremiumHeaderBase>
    );
};
