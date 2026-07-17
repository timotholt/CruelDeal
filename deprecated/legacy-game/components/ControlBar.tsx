import { Show } from 'solid-js';
import { useGame } from '../contexts/GameContext';
import { SlantedButton } from './ui/SlantedButton';
import { EnergyOrb } from './game/EnergyOrb';
import { t } from '../services/localization';

export const ControlBar = () => {
    const { 
        gameState, 
        isResolving, 
        isWaiting,
        currentEnergy, 
        isResultsHidden, 
        showUndoMenu, 
        actions, 
        setShowUndoMenu 
    } = useGame();

    return (
        <Show when={gameState()} fallback={
            <div class="h-10 px-2 pb-1 flex items-center justify-between relative bg-slate-950/50 border-t border-slate-800 opacity-50 pointer-events-none">
                <div class="flex-1" />
                <div class="w-12 h-10 flex-none" />
                <div class="flex-1 flex justify-end">
                    <SlantedButton variant="primary" size="sm" disabled>
                        {t('UI_SYNCING')}
                    </SlantedButton>
                </div>
            </div>
        }>
            {(s) => {
                const isInteractionDisabled = () => isResolving() || isWaiting() || s().phase !== 'planning';
                const isGameOver = () => s().winner !== null;

                return (
                    <div class="h-10 px-2 pb-1 flex items-center justify-between relative bg-slate-950/50 border-t border-slate-800">
                        <Show when={!isGameOver()}>
                            <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40">
                                <EnergyOrb 
                                    energy={currentEnergy()}
                                    showMenu={showUndoMenu()}
                                    disabled={isInteractionDisabled()}
                                    onClick={() => setShowUndoMenu(!showUndoMenu())}
                                    onCloseMenu={() => setShowUndoMenu(false)}
                                    onUndoAll={actions.handleUndoAll}
                                />
                            </div>
                        </Show>

                        <Show when={isGameOver()} fallback={
                            <>
                                <div class="flex-1 flex justify-start">
                                    <SlantedButton 
                                        variant="danger" 
                                        size="sm" 
                                        onClick={actions.handleResign} 
                                        disabled={isResolving()}
                                    >
                                        {t('GAME_RESIGN')}
                                    </SlantedButton>
                                </div>

                                <div class="w-12 h-10 flex-none" />

                                <div class="flex-1 flex justify-end">
                                    <SlantedButton 
                                        variant="primary" 
                                        size="sm"
                                        onClick={actions.handleEndTurn} 
                                        disabled={isResolving() || isWaiting()}
                                    >
                                        {isResolving() ? t('GAME_WAITING') : (isWaiting() ? t('GAME_READY') : t('GAME_END_TURN'))}
                                    </SlantedButton>
                                </div>
                            </>
                        }>
                            <div class="flex w-full items-center justify-between gap-2 h-full">
                                <div class="flex-1 flex justify-start">
                                    <SlantedButton 
                                        variant="secondary" 
                                        size="sm" 
                                        onClick={() => actions.toggleResults(!isResultsHidden())}
                                    >
                                        {isResultsHidden() ? t('GAME_SHOW_RESULTS') : t('GAME_HIDE_RESULTS')}
                                    </SlantedButton>
                                </div>

                                <div class="flex-1 flex justify-center">
                                    <SlantedButton 
                                        variant="secondary" 
                                        size="sm" 
                                        onClick={actions.handleExit}
                                    >
                                        {t('UI_MENU')}
                                    </SlantedButton>
                                </div>

                                <div class="flex-1 flex justify-end">
                                    <SlantedButton 
                                        variant="success" 
                                        size="sm" 
                                        onClick={actions.restartGame}
                                    >
                                        {t('GAME_PLAY_AGAIN')}
                                    </SlantedButton>
                                </div>
                            </div>
                        </Show>
                    </div>
                );
            }}
        </Show>
    );
};
