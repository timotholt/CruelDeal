import { createSignal, createMemo, createEffect, onCleanup, onMount, For, Show, Switch, Match } from 'solid-js';
import { HexBadge } from '../ui/HexBadge';
import { RewardIconGraphic } from '../ui/RewardItemVisual';
import { ProgressionRewardType } from '../../types';
import { getVariant, getScale, getPulseColor, getSpinnerColor, getCheckmarkColor, getFlareColor } from './progressionUtils';
import { GameTextV3 as GameText } from '../ui/GameTextV3';
import { Portal } from '../ui/Portal';

interface ProgressionHexButtonProps {
    type: ProgressionRewardType;
    unclaimedCount: number;
    rewardAmount?: string | number;
    isClaiming: boolean;
    isClaimingAll: boolean;
    isSuccess: boolean;
    isGlobalTicking: boolean;
    onClaim: () => void;
    onClaimAll: () => void;
}

const FloatingClaimText = (props: { 
    amount: string | number; 
    type: ProgressionRewardType; 
    x: number; 
    y: number; 
    onComplete: () => void 
}) => {
    onMount(() => {
        const timer = setTimeout(props.onComplete, 8100); 
        onCleanup(() => clearTimeout(timer));
    });

    const themeColor = () => getFlareColor(props.type);
    const isBox = () => props.type === 'box';

    return (
        <div 
            class="fixed z-[999] pointer-events-none flex items-center gap-1.5 whitespace-nowrap will-change-transform reward-float-container"
            style={{ left: `${props.x}px`, top: `${props.y}px`, color: themeColor(), filter: `drop-shadow(0 0 6px ${themeColor()}44)` }}
        >
            <Show when={!isBox()}>
                <span class="font-black italic text-sm tracking-tighter drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">+{props.amount}</span>
            </Show>
            <div class={`${isBox() ? 'w-10 h-10' : 'w-5 h-5'} drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]`}>
                <RewardIconGraphic type={props.type} size="sm" />
            </div>
        </div>
    );
};

const RadiantHexPulse = (props: { _color?: string; colorClass: string }) => {
    return (
        <div class="absolute inset-0 animate-ping pointer-events-none flex items-center justify-center overflow-visible">
            <svg viewBox="0 0 100 100" class="w-full h-full overflow-visible opacity-60">
                <path 
                    d="M50 2 L95 25 L95 75 L50 98 L5 75 L5 25 Z" 
                    fill="none" 
                    stroke="currentColor" 
                    stroke-width="3"
                    class={props.colorClass}
                    stroke-linejoin="round"
                />
            </svg>
        </div>
    );
};

const CheckmarkIcon = (props: { class?: string, delay?: number, colorClass?: string }) => (
    <svg class={`w-full h-full animate-pop ${props.colorClass || 'text-white'} ${props.class || ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width={1.5} style={{ "animation-delay": `${props.delay || 0}ms` }}>
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);

export const ProgressionHexButton = (props: ProgressionHexButtonProps) => {
    let containerRef: HTMLDivElement | undefined;
    let timerId: number | null = null;
    let hasTriggeredHold = false;

    const [progress, setProgress] = createSignal(0);
    const [isHolding, setIsHolding] = createSignal(false);
    const [pulses, setPulses] = createSignal<{ id: number }[]>([]);
    const [capturedCount, setCapturedCount] = createSignal(1);
    const [activeFloaters, setActiveFloaters] = createSignal<{ id: number; amount: string | number; x: number; y: number }[]>([]);

    const canClaim = () => props.unclaimedCount > 0;
    const colors = createMemo(() => ({
        variant: getVariant(props.type),
        pulse: getPulseColor(props.type),
        spinner: getSpinnerColor(props.type),
        checkmark: getCheckmarkColor(props.type),
        flare: getFlareColor(props.type)
    }));

    const addPulse = () => {
        const id = Date.now() + Math.random();
        setPulses(prev => [...prev, { id }]);
        setTimeout(() => {
            setPulses(prev => prev.filter(p => p.id !== id));
        }, 1000);
    };

    const triggerFloatingFeedback = (bulkCount: number = 1) => {
        if (!containerRef) return;
        const rect = containerRef.getBoundingClientRect();
        const spawnX = rect.left + rect.width / 2;
        const spawnY = rect.top + rect.height / 2;

        const isBox = props.type === 'box';
        const rawRewardAmount = props.rewardAmount;
        setTimeout(() => {
            if (isBox && bulkCount > 1) {
                for (let i = 0; i < bulkCount; i++) {
                    setTimeout(() => {
                        setActiveFloaters(p => [...p, { id: Date.now() + Math.random(), amount: 1, x: spawnX, y: spawnY }]);
                    }, i * 300);
                }
            } else {
                const amount = typeof rawRewardAmount === 'number' ? rawRewardAmount * bulkCount : (rawRewardAmount || '');
                setActiveFloaters(p => [...p, { id: Date.now() + Math.random(), amount, x: spawnX, y: spawnY }]);
            }
        }, 200);
    };

    createEffect(() => {
        if (props.isSuccess) triggerFloatingFeedback(capturedCount());
    });

    const startHold = () => {
        if (!canClaim() || props.isClaiming || props.isClaimingAll || props.isSuccess) return;
        const onClaimAll = props.onClaimAll;
        hasTriggeredHold = false;
        if (props.unclaimedCount <= 1) return;

        setIsHolding(true);
        const startTime = Date.now();
        const totalToClaim = props.unclaimedCount;
        timerId = window.setInterval(() => {
            const p = Math.min(((Date.now() - startTime) / 800) * 100, 100);
            setProgress(p);
            if (p >= 100) {
                if (timerId !== null) clearInterval(timerId);
                hasTriggeredHold = true;
                
                addPulse();
                setTimeout(addPulse, 200);
                setTimeout(addPulse, 400);

                setCapturedCount(totalToClaim);
                onClaimAll();
                setIsHolding(false);
                setProgress(0);
            }
        }, 16);
    };

    const handlePointerUp = () => {
        if (timerId !== null) clearInterval(timerId);
        
        const onClaim = props.onClaim;
        if (!hasTriggeredHold && !props.isClaiming && !props.isClaimingAll && !props.isSuccess && canClaim()) {
            addPulse();
            setCapturedCount(1);
            onClaim();
        }
        setIsHolding(false);
        setProgress(0);
    };

    const renderCheckmarks = () => {
        return (
            <Switch>
                <Match when={capturedCount() === 1}>
                    <div class="w-8 h-8"><CheckmarkIcon colorClass={colors().checkmark} /></div>
                </Match>
                <Match when={capturedCount() === 2}>
                    <div class="relative w-10 h-10">
                        <div class="absolute top-1 left-1 w-6 h-6"><CheckmarkIcon colorClass={colors().checkmark} delay={0} /></div>
                        <div class="absolute bottom-1 right-1 w-6 h-6"><CheckmarkIcon colorClass={colors().checkmark} delay={150} /></div>
                    </div>
                </Match>
                <Match when={capturedCount() >= 3}>
                    <div class="relative w-10 h-10">
                        <div class="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-5"><CheckmarkIcon colorClass={colors().checkmark} delay={0} /></div>
                        <div class="absolute bottom-0.5 left-0 w-5 h-5"><CheckmarkIcon colorClass={colors().checkmark} delay={150} /></div>
                        <div class="absolute bottom-0.5 right-0 w-5 h-5"><CheckmarkIcon colorClass={colors().checkmark} delay={300} /></div>
                    </div>
                </Match>
            </Switch>
        );
    };

    onCleanup(() => {
        if (timerId !== null) clearInterval(timerId);
    });

    return (
        <div 
            ref={(el) => containerRef = el}
            class={`relative group cursor-pointer select-none touch-none transition-all duration-300 ${!canClaim() && !props.isSuccess ? 'opacity-40 grayscale pointer-events-none' : ''} ${isHolding() ? 'brightness-125' : ''}`}
            onPointerDown={startHold} onPointerUp={handlePointerUp} onPointerLeave={() => { if(timerId !== null) clearInterval(timerId); setIsHolding(false); setProgress(0); }}
            style={{ '--flare-color': colors().flare, '--glow-color': colors().flare }}
        >
            <Portal>
                <For each={activeFloaters()}>
                    {(f) => (
                        <FloatingClaimText {...f} type={props.type} onComplete={() => setActiveFloaters(p => p.filter(i => i.id !== f.id))} />
                    )}
                </For>
            </Portal>

            <div class="absolute inset-0 z-50 pointer-events-none flex items-center justify-center overflow-visible">
                <For each={pulses()}>
                    {(_pulse) => (
                        <RadiantHexPulse colorClass={colors().checkmark} />
                    )}
                </For>
            </div>

            <Show when={isHolding()}>
                <div class="absolute inset-[-0.3rem] z-50 pointer-events-none flex items-center justify-center">
                    <svg class="w-full h-full" style={{ filter: `drop-shadow(0 0 8px var(--flare-color))` }} viewBox="0 0 100 100">
                        <path 
                            d="M50 2 L95 25 L95 75 L50 98 L5 75 L5 25 Z" 
                            fill="none" 
                            stroke={colors().flare} 
                            stroke-width="6" 
                            stroke-dasharray={`${progress() * 3.03} 303`} 
                            stroke-linecap="round" 
                            class="opacity-90" 
                        />
                    </svg>
                    <div 
                        class="absolute inset-0 animate-pulse opacity-20" 
                        style={{ 
                            "background-color": colors().flare,
                            "clip-path": 'polygon(50% 2%, 95% 25%, 95% 75%, 50% 98%, 5% 75%, 5% 25%)'
                        }} 
                    />
                </div>
            </Show>

            <HexBadge 
                variant={colors().variant} size="lg" glow={canClaim() || props.isSuccess}
                class={`${canClaim() && !props.isSuccess && !props.isClaiming && !props.isClaimingAll && !isHolding() ? 'animate-hex-glow' : ''} ${props.isSuccess ? 'animate-success-flare' : ''} transition-all duration-500`}
            >
                <div class="flex flex-col items-center justify-center w-full h-full relative overflow-visible">
                    <Show when={props.isSuccess} fallback={
                        <Show when={props.isClaiming || props.isClaimingAll} fallback={
                            <div class="relative flex items-center justify-center w-full h-full">
                                <div class={`${getScale(props.type)} ${props.type !== 'box' ? '-translate-y-[0.5rem]' : ''}`}><RewardIconGraphic type={props.type as any} size="sm" /></div>
                                <Show when={props.rewardAmount && props.type !== 'box'}>
                                    <div class="absolute left-1/2 -translate-x-1/2 bottom-[0.3rem] z-50 flex justify-center overflow-visible">
                                        <span class="text-white font-black italic drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none uppercase tracking-tighter text-[0.8rem] whitespace-nowrap">{props.rewardAmount}</span>
                                    </div>
                                </Show>
                                <Show when={props.unclaimedCount > 0}>
                                    <div 
                                        class="absolute -bottom-3 -right-3 bg-red-600 border-2 border-white h-[1.3rem] min-w-[1.3rem] px-1 flex items-center justify-center rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.6)] z-50 animate-badge-gain overflow-hidden"
                                    >
                                        <div class="w-full h-[75%]"><GameText text={props.unclaimedCount.toString()} baseFontSize={0.65} textStyle={{ fontStyle: 'normal' }} class="text-white font-black drop-shadow-md" /></div>
                                    </div>
                                </Show>
                            </div>
                        }>
                            <div class={`w-6 h-6 border-4 border-white/20 ${colors().spinner} rounded-full animate-spin`} />
                        </Show>
                    }>
                        {renderCheckmarks()}
                    </Show>
                </div>
            </HexBadge>
        </div>
    );
};
