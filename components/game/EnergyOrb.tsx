import React from 'react';
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

export const EnergyOrb: React.FC<EnergyOrbProps> = ({ energy, showMenu, disabled, onClick, onCloseMenu, onUndoAll }) => {
    return (
        <div className="relative flex flex-col items-center justify-center z-30 mx-2">
            {showMenu && (
                <div className="fixed inset-0 z-40" onClick={onCloseMenu}></div>
            )}

            {showMenu && (
                <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 animate-pop min-w-[6rem]">
                    <SlantedButton 
                        variant="blue" 
                        onClick={onUndoAll}
                    >
                        {t('GAME_UNDO_ALL')}
                    </SlantedButton>
                    <div className="w-2 h-2 bg-blue-600 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2 border-r border-b border-blue-400"></div>
                </div>
            )}

            <div 
                onClick={disabled ? undefined : onClick}
                className={`
                    w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-blue-800 border-2 border-indigo-300 shadow-[0_0_15px_rgba(79,70,229,0.5)] flex items-center justify-center relative transition-transform cursor-pointer
                    ${showMenu ? 'scale-110 ring-2 ring-white' : 'active:scale-95 hover:scale-105'}
                    ${disabled ? 'opacity-50 pointer-events-none' : ''}
                `}
            >
                <span className="text-sm font-black text-white select-none">{energy}</span>
            </div>
        </div>
    );
};