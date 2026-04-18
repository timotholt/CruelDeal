
import React, { useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useUI } from '../../contexts/UIContext';
import { SlantedButton } from '../ui/SlantedButton';
import { ScreenKey } from '../../types';

interface UserProfileDropdownProps {
    onLogout: () => void;
    onNavigate?: (s: ScreenKey) => void;
}

export const UserProfileDropdown: React.FC<UserProfileDropdownProps> = ({ onLogout, onNavigate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useUser();
    const { openActivityLog } = useUI();

    const handleProfileClick = () => {
        setIsOpen(false);
        onNavigate?.('PROFILE');
    };

    const handleSettingsClick = () => {
        setIsOpen(false);
        onNavigate?.('SETTINGS');
    };

    const handleActivityLogClick = () => {
        setIsOpen(false);
        openActivityLog();
    };

    return (
        <div className="relative">
            <SlantedButton 
                variant="primary"
                size="xs"
                onClick={() => setIsOpen(!isOpen)}
                className="!w-[9vw] max-w-[2.3rem] shadow-lg flex items-center justify-center"
                icon={
                    <div className="flex items-center justify-center w-full h-full">
                        <svg className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                }
            />

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    
                    <div className="absolute top-9 left-0 w-48 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-pop origin-top-left flex flex-col">
                        
                        <div className="p-4 border-b border-slate-800 bg-slate-950/50">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-slate-400">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-white">{user.username}</div>
                                    <div className="text-[0.6rem] text-slate-400 font-mono">Lvl {user.level}</div>
                                </div>
                            </div>
                        </div>

                        <div className="p-1 space-y-0.5">
                            <button 
                                onClick={handleProfileClick}
                                className="w-full text-left text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white px-3 py-2.5 rounded-lg transition-colors flex items-center gap-3"
                            >
                                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                Profile
                            </button>
                            <button 
                                onClick={handleSettingsClick}
                                className="w-full text-left text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white px-3 py-2.5 rounded-lg transition-colors flex items-center gap-3"
                            >
                                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                Settings
                            </button>
                            <button 
                                onClick={handleActivityLogClick}
                                className="w-full text-left text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white px-3 py-2.5 rounded-lg transition-colors flex items-center gap-3"
                            >
                                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                Activity Log
                            </button>
                            
                            <div className="h-px bg-slate-800 mx-2 my-1"></div>
                            
                            <button 
                                onClick={onLogout}
                                className="w-full text-left text-xs font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 px-3 py-2.5 rounded-lg transition-colors flex items-center gap-3"
                            >
                                <svg className="w-4 h-4 text-red-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                Logout
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
