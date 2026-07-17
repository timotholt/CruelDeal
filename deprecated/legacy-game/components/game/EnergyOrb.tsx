import { Show } from 'solid-js';
import { SlantedButton } from '../ui/SlantedButton';
import { t } from '../../services/localization';

interface EnergyOrbProps {
    energy: number;
    showMenu: boolean;
    disabled: boolean;
    onClick: () => void;
    onCloseMenu: () => void;
    onUndoAll: () => void;
}

export const EnergyOrb = (props: EnergyOrbProps) => {
    return (
        <div class="relative flex flex-col items-center justify-center z-30 mx-2">
            <Show when={props.showMenu}>
                <div class="fixed inset-0 z-40" onClick={() => props.onCloseMenu()} />
                <div class="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 animate-pop min-w-[6rem]">
                    <SlantedButton 
                        variant="blue" 
                        onClick={() => props.onUndoAll()}
                    >
                        {t('GAME_UNDO_ALL')}
                    </SlantedButton>
                    <div class="w-2 h-2 bg-blue-600 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2 border-r border-b border-blue-400" />
                </div>
            </Show>

            <div 
                onClick={() => !props.disabled && props.onClick()}
                class={`
                    w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-blue-800 border-2 border-indigo-300 shadow-[0_0_15px_rgba(79,70,229,0.5)] flex items-center justify-center relative transition-transform cursor-pointer
                    ${props.showMenu ? 'scale-110 ring-2 ring-white' : 'active:scale-95 hover:scale-105'}
                    ${props.disabled ? 'opacity-50 pointer-events-none' : ''}
                `}
            >
                <span class="text-sm font-black text-white select-none">{props.energy}</span>
            </div>
        </div>
    );
};