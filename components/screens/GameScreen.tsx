import React from 'react';
import { GameProvider } from '../../contexts/GameContext';
import { GameBoard } from '../GameBoard';
import { GameHeader } from '../GameHeader';
import { ControlBar } from '../ControlBar';
import { PlayerHand } from '../PlayerHand';
import { DragOverlay } from '../DragOverlay';
import { VfxLayer } from '../VfxLayer';

interface GameScreenProps {
    onExit: () => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({ onExit }) => {
  return (
    <GameProvider onExit={onExit}>
        <GameScreenContent />
    </GameProvider>
  );
};

const GameScreenContent: React.FC = () => {
    return (
        <div className="w-full h-full flex flex-col overflow-hidden touch-none">
            <DragOverlay />
            <VfxLayer />

            <GameHeader />

            <div className="flex-1 min-h-0 relative">
                <GameBoard />
            </div>

            <div className="shrink-0 z-30 flex flex-col bg-slate-950/80 backdrop-blur-sm">
                <PlayerHand />
                <ControlBar />
            </div>
        </div>
    );
}