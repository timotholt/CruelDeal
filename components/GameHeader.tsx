import { Show } from 'solid-js';
import { useGame } from '../contexts/GameContext';
import { PlayerAvatar } from './game/PlayerAvatar';
import { PremiumHeaderBase } from './ui/PremiumHeaderBase';

export const GameHeader = () => {
    const { gameState } = useGame();
    
    return (
        <Show when={gameState()} fallback={
            <PremiumHeaderBase class="pt-1 pb-2 px-1">
                <div class="w-full h-8 animate-pulse bg-white/5 rounded-lg" />
            </PremiumHeaderBase>
        }>
            {(s) => {
                const isP1Priority = () => s().priority === 'p1';

                return (
                    <PremiumHeaderBase 
                        class="pt-1 pb-2 px-1"
                        innerClass="justify-between items-start"
                    >
                        {/* Player 1 (Left) */}
                        <div>
                            <PlayerAvatar 
                                name="PLAYER 1"
                                label="YOU"
                                hasPriority={isP1Priority()}
                                color="indigo"
                                side="left"
                            />
                        </div>

                        {/* Turn Indicator (Center) */}
                        <Show when={s().winner === null}>
                            <div class="mt-1 flex flex-col items-center justify-center">
                                <div class="text-base font-black text-white tracking-widest drop-shadow-[0_0.125rem_4px_rgba(0,0,0,0.8)] uppercase italic">
                                    Turn {s().turn}
                                </div>
                            </div>
                        </Show>

                        {/* Player 2 (Right) */}
                        <div>
                            <PlayerAvatar 
                                name="OPPONENT"
                                label="OPP"
                                hasPriority={!isP1Priority()}
                                color="red"
                                side="right"
                            />
                        </div>
                    </PremiumHeaderBase>
                );
            }}
        </Show>
    );
};
