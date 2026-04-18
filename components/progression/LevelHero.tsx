import { Show, For, createMemo } from 'solid-js';
import { Motion, Presence } from "@motionone/solid";

interface LevelHeroProps {
    level: number;
    gain: number;
    isTicking: boolean;
    isShifted: boolean;
    isFlare: boolean;
}

const Digit = (props: { value: number }) => (
    <div class="h-[1.6rem] relative overflow-hidden w-[0.95rem] flex flex-col items-center">
        <Motion.div 
            animate={{ transform: `translateY(-${props.value * 10}%)` }}
            transition={{ duration: 0.45, easing: [0.23, 1, 0.32, 1] }}
            class="flex flex-col items-center"
        >
            <For each={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}>
                {(n) => (
                    <span class="h-[1.6rem] leading-none flex items-center justify-center font-black italic tracking-tighter text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                        {n}
                    </span>
                )}
            </For>
        </Motion.div>
    </div>
);

export const LevelHero = (props: LevelHeroProps) => {
    const digits = createMemo(() => {
        const s = props.level.toString().padStart(4, '0');
        return s.split('').map(Number);
    });

    return (
        <div class="shrink-0 pb-2 flex flex-col items-center relative overflow-visible w-full">
            <div class="relative w-full flex justify-center items-center h-14 overflow-visible">
                <Motion.div 
                    animate={{ x: props.isShifted ? -24 : 0 }}
                    transition={{ duration: 0.7, easing: [0.16, 1, 0.3, 1] }}
                    class="flex items-center gap-2"
                >
                    {/* LABEL GROUP */}
                    <div class="flex flex-col items-end text-right gap-0 opacity-80 shrink-0">
                        <span class="text-[0.45rem] font-bold tracking-[0.3em] text-white leading-none uppercase">Collection</span>
                        <span class="text-[0.5rem] font-black tracking-[0.3em] text-white leading-none uppercase">Level</span>
                    </div>
                    
                    {/* NUMBER GROUP (Slot Machine Style) */}
                    <div class="relative flex items-center overflow-visible shrink-0 text-[1.6rem]">
                        <div class={`flex items-center transition-all ${props.isTicking ? 'animate-intensity-pulse' : ''} ${props.isFlare ? 'animate-completion-flare' : ''}`}>
                            <For each={digits()}>
                                {(digit, idx) => (
                                    <>
                                        <Digit value={digit} />
                                        <Show when={(digits().length - idx() - 1) % 3 === 0 && idx() !== digits().length - 1}>
                                            <span class="text-white/30 transform -translate-y-[0.1rem] mx-[-0.1rem]">,</span>
                                        </Show>
                                    </>
                                )}
                            </For>
                        </div>
                        
                        <Presence>
                            <Show when={props.isShifted && props.gain > 0}>
                                <Motion.div 
                                    initial={{ opacity: 0, x: 16 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 8 }}
                                    transition={{ duration: 0.5, easing: [0.16, 1, 0.3, 1] }}
                                    class="absolute left-full ml-3 flex items-center"
                                >
                                    <span class="text-[1.2rem] font-black italic tracking-tighter text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.6)] leading-none">
                                        +{props.gain}
                                    </span>
                                </Motion.div>
                            </Show>
                        </Presence>
                    </div>
                </Motion.div>
            </div>
            <style>{`
                @keyframes intensity-pulse {
                    0% { transform: scale(1); filter: brightness(100%); }
                    50% { transform: scale(1.05); filter: brightness(130%); }
                    100% { transform: scale(1); filter: brightness(100%); }
                }
                .animate-intensity-pulse {
                    animation: intensity-pulse 0.3s cubic-bezier(0.16, 1, 0.3, 1) infinite;
                }
                @keyframes completion-flare {
                    0% { transform: scale(1); filter: brightness(100%); }
                    30% { transform: scale(3) rotate(3deg); filter: brightness(500%) blur(2px); opacity: 0; }
                    31% { transform: scale(0.5); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; filter: brightness(100%); }
                }
                .animate-completion-flare {
                    animation: completion-flare 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
        </div>
    );
};
