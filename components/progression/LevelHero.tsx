import { Show } from 'solid-js';

interface LevelHeroProps {
    level: number;
    gain: number;
    isTicking: boolean;
    isShifted: boolean;
    isFlare: boolean;
}

export const LevelHero = (props: LevelHeroProps) => (
    <div class="shrink-0 pb-2 flex flex-col items-center relative overflow-visible w-full">
        <div class="relative w-full flex justify-center items-center h-14 overflow-visible">
            <div 
                class={`flex items-center gap-2 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${props.isShifted ? '-translate-x-6' : 'translate-x-0'}`}
                style={{ "will-change": 'transform' }}
            >
                {/* LABEL GROUP */}
                <div class="flex flex-col items-end text-right gap-0 opacity-80 shrink-0">
                    <span class="text-[0.45rem] font-bold tracking-[0.3em] text-white leading-none uppercase">Collection</span>
                    <span class="text-[0.5rem] font-black tracking-[0.3em] text-white leading-none uppercase">Level</span>
                </div>
                
                {/* NUMBER GROUP */}
                <div class="relative flex items-center overflow-visible shrink-0">
                    <div class={`text-[1.6rem] font-black italic tracking-tighter text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] leading-none transition-all ${props.isTicking ? 'animate-intensity-pulse' : ''} ${props.isFlare ? 'animate-completion-flare' : ''}`}>
                        {props.level.toLocaleString()}
                    </div>
                    
                    <Show when={props.isShifted && props.gain >= 0}>
                        <div class="absolute left-full ml-3 flex items-center animate-gain-reveal">
                            <span class="text-[1.2rem] font-black italic tracking-tighter text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.6)] leading-none">
                                +{props.gain}
                            </span>
                        </div>
                    </Show>
                </div>
            </div>
        </div>
        <style>{`
            @keyframes gain-reveal {
                from { opacity: 0; transform: translateX(1rem); }
                to { opacity: 1; transform: translateX(0); }
            }
            .animate-gain-reveal {
                animation: gain-reveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
        `}</style>
    </div>
);
