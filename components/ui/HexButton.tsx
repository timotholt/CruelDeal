import { createSignal, onCleanup, JSX, mergeProps, splitProps, children as solidChildren, Show } from 'solid-js';
import { GameTextV3 as GameText } from './GameTextV3';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'blue';

interface HexButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    fullWidth?: boolean;
    size?: 'sm' | 'md' | 'lg';
    icon?: JSX.Element;
    holdDuration?: number; 
    onHoldChange?: (isHolding: boolean) => void;
    onProgressChange?: (progress: number) => void;
    class?: string;
}

export const HexButton = (props: HexButtonProps) => {
    const [progress, setProgress] = createSignal(0);
    const [isHolding, setIsHolding] = createSignal(false);
    let timerId: number | null = null;
    let startTime = 0;

    const merged = mergeProps({ 
        variant: 'primary' as ButtonVariant, 
        fullWidth: false,
        size: 'md' as const,
        holdDuration: 0,
        class: ''
    }, props);

    const [local, rest] = splitProps(merged, ['variant', 'fullWidth', 'size', 'icon', 'holdDuration', 'onHoldChange', 'onProgressChange', 'onClick', 'class', 'children', 'disabled']);

    const variants = {
        primary: "from-purple-600 to-purple-900 border-purple-400 shadow-[0_0.2rem_0_rgb(88,28,135)]",
        secondary: "from-slate-700 to-slate-900 border-slate-500 shadow-[0_0.2rem_0_rgb(15,23,42)]",
        success: "from-emerald-600 to-emerald-900 border-emerald-400 shadow-[0_0.2rem_0_rgb(6,78,59)]",
        danger: "from-red-600 to-red-900 border-red-400 shadow-[0_0.2rem_0_rgb(127,29,29)]",
        warning: "from-amber-600 to-amber-900 border-amber-400 shadow-[0_0.2rem_0_rgb(120,53,15)]",
        blue: "from-blue-600 to-blue-900 border-blue-400 shadow-[0_0.2rem_0_rgb(30,58,138)]",
    };

    const sizeConfigs = {
        sm: { height: "h-7", fontSize: 0.8, padding: "px-2" },
        md: { height: "h-10", fontSize: 1.0, padding: "px-4" },
        lg: { height: "h-14", fontSize: 1.2, padding: "px-6" }
    };

    const config = () => sizeConfigs[local.size];

    const startHold = (e: PointerEvent) => {
        const durVal = local.holdDuration;
        if (!durVal || local.disabled) return;
        const onProgress = local.onProgressChange;
        const onHoldChange = local.onHoldChange;
        const onClick = local.onClick;

        setIsHolding(true);
        onHoldChange?.(true);
        startTime = Date.now();
        timerId = window.setInterval(() => {
            const elapsed = Date.now() - startTime;
            const p = Math.min((elapsed / durVal) * 100, 100);
            setProgress(p);
            onProgress?.(p);
            if (p >= 100) {
                if (timerId !== null) clearInterval(timerId);
                timerId = null;
                setProgress(100);
                onProgress?.(100);
                setTimeout(() => {
                    if (onClick) {
                        (onClick as any)(e);
                    }
                    setIsHolding(false);
                    onHoldChange?.(false);
                    setProgress(0);
                    onProgress?.(0);
                }, 60);
            }
        }, 16);
    };

    const cancelHold = () => {
        if (timerId !== null) { clearInterval(timerId); timerId = null; }
        setIsHolding(false);
        local.onHoldChange?.(false);
        setProgress(0);
        local.onProgressChange?.(0);
    };

    onCleanup(() => { if (timerId !== null) clearInterval(timerId); });

    const widthClass = () => local.fullWidth ? 'w-full' : 'w-max min-w-[3.5rem]';

    const resolvedChildren = solidChildren(() => local.children);
    const isTextLike = () => typeof resolvedChildren() === 'string' || typeof resolvedChildren() === 'number';

    return (
        <div class={`relative group ${widthClass()} ${config().height} ${local.disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <button 
                class={`w-full h-full relative z-10 active:translate-y-0.5 transition-all outline-none ${local.class}`}
                onPointerDown={(e) => local.holdDuration ? startHold(e) : undefined}
                onPointerUp={() => local.holdDuration ? cancelHold() : undefined}
                onPointerLeave={() => local.holdDuration ? cancelHold() : undefined}
                onClick={() => local.holdDuration ? undefined : (local.onClick as any)}
                role="button"
                aria-busy={isHolding()}
                disabled={local.disabled}
                {...rest}
            >
                <div class={`absolute inset-0 bg-gradient-to-b border rounded skew-x-[-10deg] group-hover:brightness-110 transition-all duration-200 overflow-hidden ${variants[local.variant]}`}>
                    <Show when={local.holdDuration! > 0}>
                        <div class="absolute inset-y-0 left-0 bg-white/20 transition-all duration-75 ease-linear pointer-events-none" style={{ width: `${progress()}%` }} />
                    </Show>
                </div>
                
                <div class={`relative z-20 skew-x-[-10deg] ${config().padding} flex items-center justify-center h-full pointer-events-none`}>
                    <div class={`w-full h-full flex items-center justify-center gap-1.5 transition-opacity ${isHolding() ? 'opacity-40' : 'opacity-100'}`}>
                        <Show when={local.icon}>
                            <div class="shrink-0 flex items-center justify-center">
                                {local.icon}
                            </div>
                        </Show>
                        
                        <Show when={isTextLike()} fallback={
                             <div class="font-black text-white italic tracking-tight uppercase drop-shadow-md flex items-center gap-1 h-full w-full" style={{ "font-size": `${config().fontSize}rem` }}>
                                {resolvedChildren()}
                            </div>
                        }>
                            <div class="flex-1 h-full min-w-0">
                                <GameText 
                                    text={resolvedChildren()!.toString()} 
                                    baseFontSize={config().fontSize} 
                                    skewFactor={0.88}
                                    class="text-white drop-shadow-md font-black italic uppercase tracking-tighter"
                                />
                            </div>
                        </Show>
                    </div>
                </div>
            </button>
        </div>
    );
};
