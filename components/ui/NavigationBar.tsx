import {} from 'solid-js';
import { ScreenKey } from '../../types';
import { HomeCommandBar } from '../navigation/HomeCommandBar';
import { DeckCommandBar } from '../navigation/DeckCommandBar';
import { NavItem } from '../navigation/NavItem';
import { t } from '../../services/localization';

interface NavigationBarProps {
    activeScreen: ScreenKey;
    onNavigate: (screen: ScreenKey) => void;
}

export const NavigationBar = (props: NavigationBarProps) => {
    const isHome = () => props.activeScreen === 'MENU';
    const isDeck = () => props.activeScreen === 'DECK';
    
    const showCommandShadow = isHome;

    return (
        <div class="absolute bottom-0 left-0 right-0 z-50 pointer-events-none flex flex-col justify-end h-auto select-none overflow-visible">
            
            {/* PERSISTENT COMMAND BAR LAYER */}
            <div class="relative h-16 w-full pointer-events-none overflow-visible">
                <div class={`absolute inset-x-0 bottom-0 -top-24 bg-gradient-to-t from-black via-black/80 to-transparent -z-10 transition-opacity duration-300 ${showCommandShadow() ? 'opacity-100' : 'opacity-0'}`} />

                <div class={`absolute inset-0 transition-all duration-300 ${isHome() ? 'opacity-100 translate-y-0 block' : 'opacity-0 translate-y-4 pointer-events-none hidden'}`}>
                    <HomeCommandBar onNavigate={props.onNavigate} isActive={isHome()} />
                </div>

                <div class={`absolute inset-0 transition-all duration-300 ${isDeck() ? 'opacity-100 translate-y-0 block' : 'opacity-0 translate-y-4 pointer-events-none hidden'}`}>
                    <DeckCommandBar isActive={isDeck()} />
                </div>
            </div>

            <div class="pointer-events-auto relative z-[60] overflow-visible">
                <div class="absolute inset-0 bg-gradient-to-b from-indigo-900/60 via-slate-950/98 to-black backdrop-blur-xl shadow-[0_-15px_40px_rgba(0,0,0,0.9)]" />
                <div class="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 via-indigo-500 via-fuchsia-500 to-transparent opacity-80 z-20" />

                <div class="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-10">
                    <div class="w-48 h-12 bg-indigo-500/25 blur-3xl rounded-full" />
                    <div class="w-24 h-6 bg-fuchsia-500/15 blur-2xl rounded-full translate-x-12" />
                </div>

                <div class="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-transparent pointer-events-none z-10" />

                <div class="flex items-start justify-between px-2 pt-1.5 pb-2 gap-1.5 relative z-30">
                    <NavItem 
                        label={t('NAV_SEASON')} 
                        active={props.activeScreen === 'SEASON'}
                        onClick={() => props.onNavigate('SEASON')}
                        icon={<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" /></svg>}
                    />

                    <NavItem 
                        label={t('NAV_INBOX')} 
                        active={props.activeScreen === 'INBOX'}
                        onClick={() => props.onNavigate('INBOX')}
                        icon={
                            <svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                            </svg>
                        }
                    />

                    <NavItem 
                        label={t('NAV_MAIN')} 
                        active={props.activeScreen === 'MENU'}
                        onClick={() => props.onNavigate('MENU')}
                        icon={<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                    />

                    <NavItem 
                        label={t('NAV_COLLECTION')} 
                        active={props.activeScreen === 'DECK'}
                        onClick={() => props.onNavigate('DECK')}
                        icon={<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                    />

                    <NavItem 
                        label={t('NAV_STORE')} 
                        active={props.activeScreen === 'STORE'}
                        onClick={() => props.onNavigate('STORE')}
                        icon={<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2.5} d="M16 11V7a4 4 0 11-8 0v4M5 9h14l1 12H4L5 9z" /></svg>}
                    />
                </div>
            </div>
        </div>
    );
};
