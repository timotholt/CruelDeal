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

export const GameScreen = (props: GameScreenProps) => {
  return (
    <GameProvider onExit={props.onExit}>
        <GameScreenContent />
    </GameProvider>
  );
};

const GameScreenContent = () => {
    return (
        <div class="w-full h-full flex flex-col overflow-hidden touch-none">
            <DragOverlay />
            <VfxLayer />

            <GameHeader />

            <div class="flex-1 min-h-0 relative">
                <GameBoard />
            </div>

            <div class="shrink-0 z-30 flex flex-col bg-slate-950/80 backdrop-blur-sm">
                <PlayerHand />
                <ControlBar />
            </div>
        </div>
    );
}